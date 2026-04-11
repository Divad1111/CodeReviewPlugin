/**
 * Commands: Edit Comment & Delete Comment
 */

import * as vscode from 'vscode';
import { updateComment, deleteComment, getCommentsByReviewLog } from '../storage/commentRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';
import { ReviewComment } from '../svn/types';

/**
 * Command: Edit Comment
 */
export async function editCommentCommand(
  item: AuditTreeItem | undefined,
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  diffManager: DiffViewManager
): Promise<void> {
  let comment = item?.comment;

  // If called from editor context menu
  if (!comment) {
    comment = findCommentAtCursor();
  }

  if (!comment) {
    vscode.window.showWarningMessage('No comment found at the current line.');
    return;
  }

  const newText = await vscode.window.showInputBox({
    title: 'SVN Audit: Edit Comment',
    value: comment.commentText,
    validateInput: (value) => {
      if (!value.trim()) {return 'Comment text is required';}
      return undefined;
    },
  });

  if (newText !== undefined && newText !== comment.commentText) {
    updateComment(comment.id, newText, storagePath);
    treeProvider.refresh();

    // Refresh decorations in the current editor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'svn-audit') {
      diffManager.refreshDecorations(editor);
    }

    vscode.window.showInformationMessage('Comment updated.');
  }
}

/**
 * Command: Delete Comment
 */
export async function deleteCommentCommand(
  item: AuditTreeItem | undefined,
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  diffManager: DiffViewManager
): Promise<void> {
  let comment = item?.comment;

  // If called from editor context menu
  if (!comment) {
    comment = findCommentAtCursor();
  }

  if (!comment) {
    vscode.window.showWarningMessage('No comment found at the current line.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete this review comment for line ${comment.lineNumber}?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    deleteComment(comment.id, storagePath);
    treeProvider.refresh();

    // Refresh decorations in the current editor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'svn-audit') {
      diffManager.refreshDecorations(editor);
    }

    vscode.window.showInformationMessage('Comment deleted.');
  }
}

/**
 * Helper: Find a comment at the active editor's cursor position.
 */
function findCommentAtCursor(): ReviewComment | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'svn-audit') {return undefined;}

  const uri = editor.document.uri;
  const params = new URLSearchParams(uri.query);
  const reviewLogId = params.get('reviewLogId');
  if (!reviewLogId) {return undefined;}

  const lineNumber = editor.selection.start.line + 1;
  const comments = getCommentsByReviewLog(reviewLogId);
  
  // Default to the first one on that line if multiple exist
  return comments.find(c => c.lineNumber === lineNumber);
}
