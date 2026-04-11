/**
 * Command: Add Author to Session
 * Allows adding a new monitored author to an existing review session.
 * Fetches logs for that author and creates relevant review log entries.
 */

import * as vscode from 'vscode';
import { SvnService } from '../svn/svnService';
import { StorageContext } from '../storage/storageContext';
import { aggregateByAuthor } from '../svn/mergeAlgorithm';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';

export async function addAuthorCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  const sessionId = item.sessionId;
  if (!sessionId) {return;}

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(sessionId);
  if (!session) {
    vscode.window.showErrorMessage('Session not found.');
    return;
  }

  // Ask for new author name
  const authorName = await vscode.window.showInputBox({
    title: 'SVN Audit: Add Author',
    prompt: 'Enter the name of the author to add to this session',
    placeHolder: 'e.g. jsmith',
    validateInput: (value) => {
      if (!value.trim()) {return 'Author name is required';}
      if (session.authors.includes(value.trim())) {return 'Author already exists in this session';}
      return undefined;
    },
  });

  if (!authorName) {return;}

  const newAuthor = authorName.trim();

  // Save to history
  await provider.recordHistory('author', newAuthor);

  // Fetch and update
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `SVN Audit: Fetching changes for ${newAuthor}...`,
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Querying SVN log...', increment: 0 });

        const logEntries = await svnService.getLog(session.repoUrl, session.startDate, session.endDate);
        
        progress.report({ message: 'Aggregating changes...', increment: 50 });

        const authorMap = aggregateByAuthor(logEntries, [newAuthor]);

        if (authorMap.size === 0) {
          vscode.window.showInformationMessage(`No changes found for author ${newAuthor} in this session range.`);
        } else {
          // Create review logs for each author's files
          for (const [, changes] of authorMap) {
            for (const file of changes.files) {
              await provider.upsertReviewLog(
                session.id,
                file.path,
                changes.author,
                changes.baseRevision,
                changes.endRevision
              );
            }
          }
        }

        // Update the session author list
        const updatedAuthors = [...session.authors, newAuthor];
        await provider.updateSessionAuthors(session.id, updatedAuthors);

        progress.report({ message: 'Done!', increment: 50 });

        // Refresh tree
        treeProvider.refresh();

        vscode.window.showInformationMessage(`Added author ${newAuthor} to session.`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`SVN Audit: Failed to add author — ${err.message}`);
      }
    }
  );
}
