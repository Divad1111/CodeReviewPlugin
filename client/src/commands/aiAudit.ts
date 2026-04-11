import * as vscode from 'vscode';
import { AIService } from '../ai/aiService';
import { SvnService } from '../svn/svnService';
import { StorageContext } from '../storage/storageContext';
import { AIModelConfig } from '../storage/settingsRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';
import { ReviewLog } from '../svn/types';
import { getLocalization } from '../ui/localization';

// Output channel for AI Audit logs
const aiAuditChannel = vscode.window.createOutputChannel('SVN AI Audit');

export async function aiAuditCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  diffManager: DiffViewManager,
  storagePath: string,
  selectModel: boolean = false,
  forceAudit: boolean = false,
  fullAnalysis: boolean = false
): Promise<void> {
  const { sessionId, author, reviewLog, itemType } = item;
  if (!sessionId) { return; }

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(sessionId);
  if (!session) { return; }

  const settings = await provider.getSettings();
  const L = getLocalization(settings.language);

  // Req 1: If audited already and this is a single file, prevent re-analysis UNLESS forceAudit/fullAnalysis is true
  if (itemType === 'file' && reviewLog?.aiAudited && !selectModel && !forceAudit && !fullAnalysis) {
    vscode.window.showInformationMessage(L.alreadyAuditedMsg);
    return;
  }
  
  // Requirement 3: Model selection
  let config: AIModelConfig | null = null;
  if (selectModel) {
    const models = await provider.getAIModels();
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
    config = await provider.getAIModelByName(settings.aiModel);
  }

  if (!config) {
    vscode.window.showErrorMessage(L.modelNotFound);
    return;
  }

  if (!config.apiKey) {
    vscode.window.showErrorMessage(`${L.apiKeyMissing} (${config.name})`);
    return;
  }

  aiAuditChannel.clear();
  aiAuditChannel.show();
  aiAuditChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${L.aiAuditStart}`);
  if (fullAnalysis) {
    aiAuditChannel.appendLine(`Mode: FULL ANALYSIS (using entire file content)`);
  }
  aiAuditChannel.appendLine(`Session: ${session.name}`);
  aiAuditChannel.appendLine(`Model: ${config.name} (${config.modelName})`);

  // Req 1 & 2: Determine which logs to process
  let reviewLogs: ReviewLog[] = [];
  if (itemType === 'file' && reviewLog) {
    reviewLogs = [reviewLog];
    aiAuditChannel.appendLine(`Target: Single file (${reviewLog.filePath})`);
  } else if (itemType === 'person' && author) {
    aiAuditChannel.appendLine(`Target: All files for author (${author})`);
    const allLogs = await provider.getReviewLogsByAuthor(sessionId, author);
    
    reviewLogs = (selectModel || forceAudit || fullAnalysis) ? allLogs : allLogs.filter(rl => !rl.aiAudited);
    
    const skippedCount = allLogs.length - reviewLogs.length;
    if (skippedCount > 0 && !selectModel && !forceAudit && !fullAnalysis) {
      aiAuditChannel.appendLine(L.skippingAudited);
    } else if ((selectModel || forceAudit || fullAnalysis) && allLogs.length > 0) {
      aiAuditChannel.appendLine(L.forcingReAudit);
    }
  }

  if (reviewLogs.length === 0) {
    aiAuditChannel.appendLine('Nothing to analyze (all files might be already audited).');
    vscode.window.showInformationMessage(`No new files to analyze.`);
    return;
  }

  const aiService = new AIService();
  const logger = settings.debugMode ? (msg: string) => aiAuditChannel.appendLine(msg) : undefined;

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
        await provider.deleteAiComments(rl.id);

        aiAuditChannel.appendLine(`\n--------------------------------------------------`);
        aiAuditChannel.appendLine(`Analyzing file: ${rl.filePath}`);
        progress.report({ message: `Analyzing ${rl.filePath}...`, increment: (1 / reviewLogs.length) * 100 });

        try {
          if (!rl.baseRevision || !rl.endRevision) {
            aiAuditChannel.appendLine(`Skipping: Missing revision information`);
            continue;
          }

          let contentToAnalyze: string;
          if (fullAnalysis) {
            aiAuditChannel.appendLine('Fetching full file content...');
            contentToAnalyze = await svnService.getCat(session.repoUrl, rl.filePath, rl.endRevision);
          } else {
            contentToAnalyze = await svnService.getDiffForFile(session.repoUrl, rl.filePath, rl.baseRevision - 1, rl.endRevision);
          }

          if (!contentToAnalyze.trim()) {
            aiAuditChannel.appendLine('Skipping: Content is empty.');
            continue;
          }

          // Analyze with AI
          const results = await aiService.analyzeDiff(
            rl.filePath, 
            contentToAnalyze, 
            settings.codingStandards || '', 
            logger,
            config || undefined,
            fullAnalysis
          );

          aiAuditChannel.appendLine(`AI suggested ${results.comments.length} comments.`);

          for (const c of results.comments) {
            aiAuditChannel.appendLine(`  - [Line ${c.line}]: ${c.text}`);
            await provider.addComment(
              rl.id,
              c.line,
              `[🤖 AI] ${c.text}`,
              c.codeSnippet,
              String(rl.endRevision)
            );
            totalComments++;
          }
          
          // Mark as audited
          await provider.updateAiAuditStatus(rl.id, true);
          filesProcessed++;
        } catch (err: any) {
          aiAuditChannel.appendLine(`Error: ${err.message}`);
          console.error(`AI Analysis failed for ${rl.filePath}:`, err.message);
        }
      }

      aiAuditChannel.appendLine(`\n==================================================`);
      aiAuditChannel.appendLine(L.aiAuditComplete);
      aiAuditChannel.appendLine(`Total files processed: ${filesProcessed}`);
      aiAuditChannel.appendLine(`Total comments added: ${totalComments}`);

      treeProvider.refresh();
      vscode.window.showInformationMessage(L.aiAuditComplete);
    }
  );
}
