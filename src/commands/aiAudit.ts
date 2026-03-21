import * as vscode from 'vscode';
import { AIService } from '../ai/aiService';
import { SvnService } from '../svn/svnService';
import { getSettings, getAIModelByName, getAIModels, AIModelConfig } from '../storage/settingsRepo';
import { getSessionById } from '../storage/sessionRepo';
import { getReviewLogsByAuthor, updateAiAuditStatus } from '../storage/reviewRepo';
import { addComment, deleteAiComments } from '../storage/commentRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';
import { ReviewLog } from '../svn/types';

// Output channel for AI Audit logs
const aiAuditChannel = vscode.window.createOutputChannel('SVN AI Audit');

export async function aiAuditCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  diffManager: DiffViewManager,
  storagePath: string,
  selectModel: boolean = false
): Promise<void> {
  const { sessionId, author, reviewLog, itemType } = item;
  if (!sessionId) { return; }

  const session = getSessionById(sessionId);
  if (!session) { return; }

  // Req 1: If audited already and this is a single file, prevent re-analysis
  if (itemType === 'file' && reviewLog?.aiAudited && !selectModel) {
    vscode.window.showInformationMessage(`This file has already been audited by AI. Use the context menu (Select Model) if you wish to re-audit.`);
    return;
  }

  const settings = getSettings();
  
  // Requirement 3: Model selection
  let config: AIModelConfig | null = null;
  if (selectModel) {
    const models = getAIModels();
    const items = models.map(m => ({
      label: m.name,
      description: `${m.endpoint} (${m.modelName})`,
      model: m
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select AI Model for this audit'
    });
    
    if (!selected) { return; }
    config = selected.model;
  } else {
    config = getAIModelByName(settings.aiModel);
  }

  if (!config) {
    vscode.window.showErrorMessage(`AI Model configuration not found.`);
    return;
  }

  if (!config.apiKey) {
    vscode.window.showErrorMessage(`AI API Key is missing for model '${config.name}'. Please set it in SVN Audit settings (Edit Model).`);
    return;
  }

  aiAuditChannel.clear();
  aiAuditChannel.show();
  aiAuditChannel.appendLine(`[${new Date().toLocaleTimeString()}] Starting AI Audit`);
  aiAuditChannel.appendLine(`Session: ${session.name}`);
  aiAuditChannel.appendLine(`Model: ${config.name} (${config.modelName})`);

  // Req 1 & 2: Determine which logs to process
  let reviewLogs: ReviewLog[] = [];
  if (itemType === 'file' && reviewLog) {
    reviewLogs = [reviewLog];
    aiAuditChannel.appendLine(`Target: Single file (${reviewLog.filePath})`);
  } else if (itemType === 'person' && author) {
    aiAuditChannel.appendLine(`Target: All files for author (${author})`);
    const allLogs = getReviewLogsByAuthor(sessionId, author);
    
    // Filter out already audited files (Requirement 1)
    // If selectModel is true, we force re-analysis (Requirement 3/Latest request)
    reviewLogs = selectModel ? allLogs : allLogs.filter(rl => !rl.aiAudited);
    
    const skippedCount = allLogs.length - reviewLogs.length;
    if (skippedCount > 0 && !selectModel) {
      aiAuditChannel.appendLine(`Skipping ${skippedCount} files that were already AI-audited.`);
    } else if (selectModel && allLogs.length > 0) {
      aiAuditChannel.appendLine(`Forcing re-analysis of all ${allLogs.length} files.`);
    }
  }

  if (reviewLogs.length === 0) {
    aiAuditChannel.appendLine('Nothing to analyze (all files might be already audited).');
    vscode.window.showInformationMessage(`No new files to analyze.`);
    return;
  }

  const aiService = new AIService();
  const logger = (msg: string) => aiAuditChannel.appendLine(msg);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `SVN Audit: AI analyzing...`,
      cancellable: true,
    },
    async (progress, token) => {
      let filesProcessed = 0;
      let totalComments = 0;

      for (const rl of reviewLogs) {
        if (token.isCancellationRequested) {
          aiAuditChannel.appendLine('AI Audit canceled by user.');
          break;
        }

        // Before adding new comments, delete existing AI comments for this file to avoid duplication
        deleteAiComments(rl.id, storagePath);

        aiAuditChannel.appendLine(`\n--------------------------------------------------`);
        aiAuditChannel.appendLine(`Analyzing file: ${rl.filePath}`);
        progress.report({ message: `Analyzing ${rl.filePath}...`, increment: (1 / reviewLogs.length) * 100 });

        try {
          if (!rl.baseRevision || !rl.endRevision) {
            aiAuditChannel.appendLine(`Skipping: Missing revision information`);
            continue;
          }

          // Fetch diff (base is r-1 to get the changes in r)
          const diff = await svnService.getDiffForFile(session.repoUrl, rl.filePath, rl.baseRevision - 1, rl.endRevision);

          if (!diff.trim()) {
            aiAuditChannel.appendLine('Skipping: Diff is empty.');
            continue;
          }

          // Analyze with AI (Req 4: logger passed here)
          const results = await aiService.analyzeDiff(
            rl.filePath, 
            diff, 
            settings.codingStandards || '', 
            logger,
            config || undefined
          );

          aiAuditChannel.appendLine(`AI suggested ${results.comments.length} comments.`);

          for (const c of results.comments) {
            aiAuditChannel.appendLine(`  - [Line ${c.line}]: ${c.text}`);
            addComment(
              rl.id,
              c.line,
              `[🤖 AI] ${c.text}`,
              storagePath,
              c.codeSnippet,
              String(rl.endRevision)
            );
            totalComments++;
          }
          
          // Mark as audited (Requirement 1)
          updateAiAuditStatus(rl.id, true, storagePath);
          filesProcessed++;
        } catch (err: any) {
          aiAuditChannel.appendLine(`Error: ${err.message}`);
          console.error(`AI Analysis failed for ${rl.filePath}:`, err.message);
        }
      }

      aiAuditChannel.appendLine(`\n==================================================`);
      aiAuditChannel.appendLine(`AI Audit Complete.`);
      aiAuditChannel.appendLine(`Total files processed: ${filesProcessed}`);
      aiAuditChannel.appendLine(`Total comments added: ${totalComments}`);

      treeProvider.refresh();
      vscode.window.showInformationMessage(`AI Audit complete! Processed ${filesProcessed} files.`);
    }
  );
}
