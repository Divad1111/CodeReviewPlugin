/**
 * Manages opening read-only diff views for audit files.
 */

import * as vscode from 'vscode';
import { ReviewLog } from '../svn/types';
import { SvnContentProvider } from './svnContentProvider';
import { getSessionById } from '../storage/sessionRepo';

export class DiffViewManager {
  constructor() {}

  /**
   * Open a diff view for the given review log entry.
   * Left side: base revision (before changes)
   * Right side: end revision (after changes)
   */
  async openDiffView(reviewLog: ReviewLog): Promise<void> {
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
      repoUrl
    );
    const rightUri = SvnContentProvider.buildUri(
      reviewLog.filePath,
      reviewLog.endRevision,
      repoUrl
    );

    const title = `${reviewLog.filePath} (r${reviewLog.baseRevision - 1} ↔ r${reviewLog.endRevision})`;

    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active,
    });
  }
}
