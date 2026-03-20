/**
 * Command: New Review Session
 * Opens a webview panel to gather SVN repository URL, author names, and date range.
 * Fetches SVN log, computes aggregated changes, and creates a session in DB.
 */

import * as vscode from 'vscode';
import { SvnService } from '../svn/svnService';
import { aggregateByAuthor } from '../svn/mergeAlgorithm';
import { createSession } from '../storage/sessionRepo';
import { upsertReviewLog } from '../storage/reviewRepo';
import { recordHistory } from '../storage/historyRepo';
import { AuditTreeDataProvider } from '../ui/auditTreeProvider';
import { createNewSessionPanel } from '../ui/newSessionPanel';

export async function newSessionCommand(
  extensionUri: vscode.Uri,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  treeView: vscode.TreeView<any>,
  storagePath: string
): Promise<void> {

  // Open the webview panel for session config
  createNewSessionPanel(extensionUri, async (data) => {
    const { command, name, repoUrl, authors: authorsStr, startDate, endDate, username, password, type, value } = data as any;

    if (command === 'deleteHistory') {
      import('../storage/historyRepo').then(repo => repo.deleteHistory(type, value, storagePath));
      return;
    }

    const authors = authorsStr.split(',').map((a: string) => a.trim()).filter((a: string) => a.length > 0);

    if (authors.length === 0 || !repoUrl) {
      vscode.window.showErrorMessage('Invalid inputs from the new session form.');
      return;
    }

    // Save inputs to history
    recordHistory('repo_url', repoUrl, storagePath);
    authors.forEach((author: string) => recordHistory('author', author, storagePath));

    // Fetch SVN log with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SVN Audit: Fetching logs...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: 'Querying SVN log...', increment: 0 });

          const logEntries = await svnService.getLog(repoUrl, startDate, endDate, username, password);

          if (logEntries.length === 0) {
            vscode.window.showWarningMessage(
              'No SVN log entries found for the given date range.'
            );
            return;
          }

          progress.report({ message: 'Aggregating changes...', increment: 40 });

          // Aggregate by author
          const authorMap = aggregateByAuthor(logEntries, authors);

          if (authorMap.size === 0) {
            vscode.window.showWarningMessage(
              `No changes found for authors: ${authors.join(', ')}`
            );
            return;
          }

          progress.report({ message: 'Creating session...', increment: 30 });

          // Create session
          const session = createSession(name, repoUrl, startDate, endDate, authors, storagePath);

          // Create review logs for each author's files
          for (const [, changes] of authorMap) {
            for (const file of changes.files) {
              upsertReviewLog(
                session.id,
                file.path,
                changes.author,
                storagePath,
                changes.baseRevision,
                changes.endRevision
              );
            }
          }

          progress.report({ message: 'Done!', increment: 30 });

          // Refresh tree
          treeProvider.refresh();

          // Wait a tick for the tree provider to register the new item
          setTimeout(() => {
            const item = treeProvider.findSessionItem(session.id);
            if (item) {
              treeView.reveal(item, { select: true, focus: true, expand: true });
            }
          }, 100);

          vscode.window.showInformationMessage(
            `SVN Audit: Session created with ${authorMap.size} author(s) and ${Array.from(authorMap.values()).reduce((sum, a) => sum + a.files.length, 0)} file(s).`
          );
        } catch (err: any) {
          vscode.window.showErrorMessage(`SVN Audit: Failed to create session — ${err.message}`);
        }
      }
    );
  });
}
