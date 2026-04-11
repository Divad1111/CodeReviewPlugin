/**
 * Command: Delete Author from Session
 * Removes the author from the session's author list and deletes their review logs/comments.
 */

import * as vscode from 'vscode';
import { StorageContext } from '../storage/storageContext';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';

export async function deleteAuthorCommand(
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) {return;}

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(sessionId);
  if (!session) {return;}

  const confirm = await vscode.window.showWarningMessage(
    `Remove author "${author}" and all their review data from this session?`,
    { modal: true },
    'Remove'
  );

  if (confirm === 'Remove') {
    // 1. Delete review logs and comments
    await provider.deleteReviewLogsByAuthor(sessionId, author);

    // 2. Delete summary
    await provider.deleteSummary(sessionId, author);

    // 3. Update session author list
    const updatedAuthors = session.authors.filter(a => a !== author);
    await provider.updateSessionAuthors(sessionId, updatedAuthors);

    // 4. Refresh tree
    treeProvider.refresh();

    vscode.window.showInformationMessage(`Author "${author}" removed.`);
  }
}
