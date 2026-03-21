/**
 * Manages opening read-only diff views for audit files.
 */

import * as vscode from 'vscode';
import { ReviewLog, ReviewComment } from '../svn/types';
import { SvnContentProvider } from './svnContentProvider';
import { getSessionById } from '../storage/sessionRepo';
import { getCommentsByReviewLog } from '../storage/commentRepo';
import { applyCommentDecorations, clearDecorations } from './coverageDecorations';

export class DiffViewManager {
  private activeLogs = new Map<string, ReviewLog>();

  constructor() {
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
  }

  public refreshDecorations(editor: vscode.TextEditor): void {
    const uri = editor.document.uri.toString();
    const log = this.activeLogs.get(uri);
    if (!log) {
      return;
    }
    
    const comments = getCommentsByReviewLog(log.id);
    if (comments && comments.length > 0) {
      applyCommentDecorations(editor, comments);
    } else {
      clearDecorations(editor);
    }
  }

  /**
   * Open a diff view for the given review log entry.
   * Left side: base revision (before changes)
   * Right side: end revision (after changes)
   */
  async openDiffView(reviewLog: ReviewLog, comment?: ReviewComment): Promise<void> {
    const session = getSessionById(reviewLog.sessionId);
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
      reviewLog.baseRevision - 1, // Show the state BEFORE the author's first change
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
      this.refreshDecorations(editor);
      if (comment) {
        const line = Math.max(0, comment.lineNumber - 1);
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(line, 0, line, 0);
      }
    }
  }
}
