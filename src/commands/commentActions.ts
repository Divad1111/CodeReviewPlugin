/**
 * Commands: Edit Comment & Delete Comment
 */

import * as vscode from 'vscode';
import { updateComment, deleteComment } from '../storage/commentRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { DiffViewManager } from '../ui/diffViewManager';

/**
 * Command: Edit Comment
 */
export async function editCommentCommand(
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  diffManager: DiffViewManager
): Promise<void> {
  if (!item.comment) {return;}

  const newText = await vscode.window.showInputBox({
    title: 'SVN Audit: Edit Comment',
    value: item.comment.commentText,
    validateInput: (value) => {
      if (!value.trim()) {return 'Comment text is required';}
      return undefined;
    },
  });

  if (newText !== undefined && newText !== item.comment.commentText) {
    updateComment(item.comment.id, newText, storagePath);
    treeProvider.refresh();

    // Refresh decorations if we have an active editor for this file
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
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  diffManager: DiffViewManager
): Promise<void> {
  if (!item.comment) {return;}

  const confirm = await vscode.window.showWarningMessage(
    'Delete this review comment?',
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    deleteComment(item.comment.id, storagePath);
    treeProvider.refresh();

    // Refresh decorations if we have an active editor for this file
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'svn-audit') {
      diffManager.refreshDecorations(editor);
    }

    vscode.window.showInformationMessage('Comment deleted.');
  }
}
