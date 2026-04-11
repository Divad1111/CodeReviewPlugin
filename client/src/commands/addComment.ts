/**
 * Command: Add Comment
 * Right-click context menu command to add a review comment on the selected line(s).
 */

import * as vscode from 'vscode';
import { StorageContext } from '../storage/storageContext';
import { AuditTreeDataProvider } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';

export async function addCommentCommand(
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  diffManager: DiffViewManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor.');
    return;
  }

  // Check if we're in an svn-audit scheme document
  const uri = editor.document.uri;
  if (uri.scheme !== 'svn-audit') {
    vscode.window.showWarningMessage('This command is only available in SVN Audit diff views.');
    return;
  }

  // Get the selected line number
  const selection = editor.selection;
  const lineNumber = selection.start.line + 1; // 1-indexed

  // Extract file path from URI
  const filePath = uri.path;

  // Get the code snippet at the selected line(s)
  const codeSnippet = editor.document.getText(
    new vscode.Range(selection.start.line, 0, selection.end.line, Number.MAX_SAFE_INTEGER)
  );

  // Extract parameters from URI
  const params = new URLSearchParams(uri.query);
  const reviewLogId = params.get('reviewLogId');
  const revision = params.get('rev') || undefined;

  // Find the matching review log
  const reviewLog = await findReviewLogForFile(filePath, reviewLogId);
  if (!reviewLog) {
    vscode.window.showWarningMessage('Could not find a matching review log for this file. Make sure you opened this from the SVN Audit sidebar.');
    return;
  }

  const provider = StorageContext.getProvider();
  const comments = await provider.getCommentsByReviewLog(reviewLog.id);
  const existingComment = comments.find((c: any) => c.lineNumber === lineNumber);

  // Ask for comment text
  const commentText = await vscode.window.showInputBox({
    title: existingComment ? 'SVN Audit: Edit Comment' : 'SVN Audit: Add Comment',
    prompt: existingComment ? `Edit existing comment for line ${lineNumber}` : `Add comment for line ${lineNumber}`,
    value: existingComment ? existingComment.commentText : '',
    placeHolder: 'Enter your review comment...',
    validateInput: (value) => {
      if (!value.trim()) {return 'Comment text is required';}
      return undefined;
    },
  });

  if (!commentText) {return;}

  // If comment already exists on this line, delete it first (Replace logic)
  if (existingComment) {
    await provider.deleteComment(existingComment.id);
  }

  // Save comment
  await provider.addComment(
    reviewLog.id,
    lineNumber,
    commentText,
    codeSnippet,
    revision
  );

  // Refresh tree to update icon
  treeProvider.refresh();

  // Refresh decorations in the current editor
  diffManager.refreshDecorations(editor);

  vscode.window.showInformationMessage(existingComment ? `Comment updated at line ${lineNumber}.` : `Comment added at line ${lineNumber}.`);
}

/**
 * Find a review log that matches the given file path or ID.
 */
async function findReviewLogForFile(filePath: string, reviewLogId: string | null): Promise<{ id: string } | null> {
  const provider = StorageContext.getProvider();
  const sessions = await provider.getSessions();
  
  if (reviewLogId) {
    for (const session of sessions) {
      const reviewLogs = await provider.getReviewLogsBySession(session.id);
      const found = reviewLogs.find(rl => rl.id === reviewLogId);
      if (found) {return found;}
    }
  }

  for (const session of sessions) {
    const reviewLogs = await provider.getReviewLogsBySession(session.id);
    for (const rl of reviewLogs) {
      if (filePath === rl.filePath) {
        return rl;
      }
    }
  }
  return null;
}
