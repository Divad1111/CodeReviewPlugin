/**
 * Command: Delete Author from Session
 * Removes the author from the session's author list and deletes their review logs/comments.
 */

import * as vscode from 'vscode';
import { getSessionById, updateSessionAuthors } from '../storage/sessionRepo';
import { deleteReviewLogsByAuthor } from '../storage/reviewRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';

export async function deleteAuthorCommand(
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) {return;}

  const session = getSessionById(sessionId);
  if (!session) {return;}

  const confirm = await vscode.window.showWarningMessage(
    `Remove author "${author}" and all their review data from this session?`,
    { modal: true },
    'Remove'
  );

  if (confirm === 'Remove') {
    // 1. Delete review logs and comments
    deleteReviewLogsByAuthor(sessionId, author, storagePath);

    // 2. Update session author list
    const updatedAuthors = session.authors.filter(a => a !== author);
    updateSessionAuthors(sessionId, updatedAuthors, storagePath);

    // 3. Refresh tree
    treeProvider.refresh();

    vscode.window.showInformationMessage(`Author "${author}" removed.`);
  }
}
