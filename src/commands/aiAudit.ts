/**
 * Command: AI Audit
 * Analyzes an author's changes using AI and adds comments automatically.
 */

import * as vscode from 'vscode';
import { AIService } from '../ai/aiService';
import { SvnService } from '../svn/svnService';
import { getSettings } from '../storage/settingsRepo';
import { getSessionById } from '../storage/sessionRepo';
import { getReviewLogsByAuthor } from '../storage/reviewRepo';
import { addComment } from '../storage/commentRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';

export async function aiAuditCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  diffManager: DiffViewManager,
  storagePath: string
): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) {return;}

  const session = getSessionById(sessionId);
  if (!session) {return;}

  const settings = getSettings();
  if (!settings.aiApiKey) {
    vscode.window.showErrorMessage('AI API Key is missing. Please set it in SVN Audit settings.');
    return;
  }

  const reviewLogs = getReviewLogsByAuthor(sessionId, author);
  if (reviewLogs.length === 0) {
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
        if (token.isCancellationRequested) {break;}

        progress.report({ message: `Analyzing ${rl.filePath}...`, increment: (1 / reviewLogs.length) * 100 });

        try {
          // 1. Get diff
          if (!rl.baseRevision || !rl.endRevision) {continue;}
          const diff = await svnService.getDiff(session.repoUrl, rl.baseRevision - 1, rl.endRevision);

          // 2. Analyze with AI
          const results = await aiService.analyzeDiff(rl.filePath, diff, settings);

          // 3. Add comments
          for (const c of results.comments) {
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
          console.error(`AI Analysis failed for ${rl.filePath}:`, err.message);
          // Continue with next file
        }
      }

      // 4. Refresh UI
      treeProvider.refresh();
      
      // Refresh decorations if we have an active editor for a file we just analyzed
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.uri.scheme === 'svn-audit') {
        diffManager.refreshDecorations(editor);
      }

      vscode.window.showInformationMessage(`AI Audit complete! Processed ${filesProcessed} files and added ${totalComments} comments.`);
    }
  );
}
