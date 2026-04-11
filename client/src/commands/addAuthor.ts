/**
 * Command: Add Author to Session
 * Allows adding a new monitored author to an existing review session.
 * Fetches logs for that author and creates relevant review log entries.
 */

import * as vscode from 'vscode';
import { SvnService } from '../svn/svnService';
import { getSessionById, updateSessionAuthors } from '../storage/sessionRepo';
import { recordHistory } from '../storage/historyRepo';
import { upsertReviewLog } from '../storage/reviewRepo';
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

  const session = getSessionById(sessionId);
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
  recordHistory('author', newAuthor, storagePath);

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
          // Still add them to the authors list so they show up as an empty folder? 
          // Actually, AuditTreeDataProvider gets person nodes FROM ReviewLogs, so we should always add them if they HAVE logs.
        } else {
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
        }

        // Update the session author list
        const updatedAuthors = [...session.authors, newAuthor];
        updateSessionAuthors(session.id, updatedAuthors, storagePath);

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
