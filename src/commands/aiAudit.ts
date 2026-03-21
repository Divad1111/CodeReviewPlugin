import * as vscode from 'vscode';
import { AIService } from '../ai/aiService';
import { SvnService } from '../svn/svnService';
import { getSettings, getAIModelByName, upsertAIModel } from '../storage/settingsRepo';
import { getSessionById } from '../storage/sessionRepo';
import { getReviewLogsByAuthor } from '../storage/reviewRepo';
import { addComment } from '../storage/commentRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';

// Output channel for AI Audit logs
const aiAuditChannel = vscode.window.createOutputChannel('SVN AI Audit');

export async function aiAuditCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  diffManager: DiffViewManager,
  storagePath: string
): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) { return; }

  const session = getSessionById(sessionId);
  if (!session) { return; }

  const settings = getSettings();
  const config = getAIModelByName(settings.aiModel);
  if (!config) {
    vscode.window.showErrorMessage(`AI Model '${settings.aiModel}' not found.`);
    return;
  }

  if (!config.apiKey) {
    vscode.window.showErrorMessage(`AI API Key is missing for model '${settings.aiModel}'. Please set it in SVN Audit settings (Edit Model).`);
    return;
  }


  aiAuditChannel.clear();
  aiAuditChannel.show();
  aiAuditChannel.appendLine(`[${new Date().toLocaleTimeString()}] Starting AI Audit for author: ${author}`);
  aiAuditChannel.appendLine(`Session: ${session.name} (${session.startDate} to ${session.endDate})`);
  aiAuditChannel.appendLine(`Model: ${settings.aiModel}`);

  const reviewLogs = getReviewLogsByAuthor(sessionId, author);
  aiAuditChannel.appendLine(`Found ${reviewLogs.length} review log entries for this author.`);

  if (reviewLogs.length === 0) {
    aiAuditChannel.appendLine('Nothing to analyze.');
    vscode.window.showInformationMessage(`No files found for author ${author}.`);
    return;
  }

  const aiService = new AIService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `SVN Audit: AI analyzing ${author}'s work...`,
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

        aiAuditChannel.appendLine(`\n--------------------------------------------------`);
        aiAuditChannel.appendLine(`Analyzing file: ${rl.filePath}`);
        progress.report({ message: `Analyzing ${rl.filePath}...`, increment: (1 / reviewLogs.length) * 100 });

        try {
          if (!rl.baseRevision || !rl.endRevision) {
            aiAuditChannel.appendLine(`Skipping: Missing revision information (r${rl.baseRevision}..r${rl.endRevision})`);
            continue;
          }

          aiAuditChannel.appendLine(`Fetching diff for file (r${rl.baseRevision - 1} : r${rl.endRevision})...`);
          const diff = await svnService.getDiffForFile(session.repoUrl, rl.filePath, rl.baseRevision - 1, rl.endRevision);

          if (!diff.trim()) {
            aiAuditChannel.appendLine('Skipping: Diff is empty.');
            continue;
          }

          // 2. Analyze with AI
          aiAuditChannel.appendLine(`Calling AI (${settings.aiModel})...`);
          const results = await aiService.analyzeDiff(rl.filePath, diff, settings.codingStandards || '');

          aiAuditChannel.appendLine(`AI suggested ${results.comments.length} comments.`);

          // 3. Add comments
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

      // 4. Refresh UI
      treeProvider.refresh();

      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.uri.scheme === 'svn-audit') {
        diffManager.refreshDecorations(editor);
      }

      vscode.window.showInformationMessage(`AI Audit complete! Processed ${filesProcessed} files and added ${totalComments} comments.`);
    }
  );
}
