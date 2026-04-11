/**
 * Manages opening read-only diff views for audit files.
 */

import * as vscode from 'vscode';
import { ReviewLog, ReviewComment } from '../svn/types';
import { SvnContentProvider } from './svnContentProvider';
import { StorageContext } from '../storage/storageContext';
import { applyCommentDecorations, clearDecorations } from './coverageDecorations';
import { AuditTreeDataProvider, AuditTreeItem } from './auditTreeProvider';

export class DiffViewManager {
  private activeLogs = new Map<string, ReviewLog>();

  constructor(
    private treeView: vscode.TreeView<AuditTreeItem>,
    private treeProvider: AuditTreeDataProvider
  ) {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.scheme === 'svn-audit') {
        this.refreshDecorations(editor);
      }
    });

    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      editors.forEach(editor => {
        if (editor.document.uri.scheme === 'svn-audit') {
          this.refreshDecorations(editor);
        }
      });
    });

    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.uri.scheme === 'svn-audit') {
        this.selectTreeItemForLine(event.textEditor);
      }
    });
  }

  private async selectTreeItemForLine(editor: vscode.TextEditor): Promise<void> {
    const uri = editor.document.uri.toString();
    const log = this.activeLogs.get(uri);
    if (!log) { return; }

    const lineNumber = editor.selection.start.line + 1;
    const provider = StorageContext.getProvider();
    const comments = await provider.getCommentsByReviewLog(log.id);
    const comment = comments.find(c => c.lineNumber === lineNumber);

    if (comment) {
      const item = await this.treeProvider.findCommentItem(log.id, comment.id);
      if (item) {
        this.treeView.reveal(item, { select: true, focus: false, expand: true });
      }
    }
  }

  public async refreshDecorations(editor: vscode.TextEditor): Promise<void> {
    const uri = editor.document.uri.toString();
    const log = this.activeLogs.get(uri);
    if (!log) {
      return;
    }

    const provider = StorageContext.getProvider();
    const comments = await provider.getCommentsByReviewLog(log.id);
    if (comments && comments.length > 0) {
      applyCommentDecorations(editor, comments);
    } else {
      clearDecorations(editor);
    }
  }

  /**
   * Open a diff view for the given review log entry.
   */
  async openDiffView(reviewLog: ReviewLog, comment?: ReviewComment): Promise<void> {
    const provider = StorageContext.getProvider();
    const session = await provider.getSessionById(reviewLog.sessionId);
    if (!session) {
      vscode.window.showErrorMessage('Session not found.');
      return;
    }

    if (!reviewLog.baseRevision || !reviewLog.endRevision) {
      vscode.window.showErrorMessage('Revision information not available for this file.');
      return;
    }

    const repoUrl = session.repoUrl;
    const leftUri = SvnContentProvider.buildUri(
      reviewLog.filePath,
      reviewLog.baseRevision - 1,
      repoUrl,
      reviewLog.id
    );
    const rightUri = SvnContentProvider.buildUri(
      reviewLog.filePath,
      reviewLog.endRevision,
      repoUrl,
      reviewLog.id
    );

    const title = `${reviewLog.filePath} (r${reviewLog.baseRevision - 1} ↔ r${reviewLog.endRevision})`;

    this.activeLogs.set(rightUri.toString(), reviewLog);

    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active,
    });

    const editors = vscode.window.visibleTextEditors.filter(
      e => e.document.uri.toString() === rightUri.toString()
    );

    for (const editor of editors) {
      await this.refreshDecorations(editor);
      if (comment) {
        const line = Math.max(0, comment.lineNumber - 1);
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(line, 0, line, 0);
      }
    }
  }
}
