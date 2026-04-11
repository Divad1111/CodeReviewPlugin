/**
 * Command: Delete File from Review
 * Removes a file entry (ReviewLog) from the current audit session.
 */

import * as vscode from 'vscode';
import { AuditTreeItem, AuditTreeDataProvider } from '../ui/auditTreeProvider';
import { deleteReviewLog } from '../storage/reviewRepo';
import { getSettings } from '../storage/settingsRepo';
import { getLocalization } from '../ui/localization';

export async function deleteFileCommand(
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  if (!item.reviewLog) {
    vscode.window.showErrorMessage('No file entry found to delete.');
    return;
  }

  const settings = getSettings();
  const L = getLocalization(settings.language);

  const confirm = await vscode.window.showWarningMessage(
    `${L.deleteFile}? \n\n${item.reviewLog.filePath}`,
    { modal: true },
    'OK'
  );

  if (confirm === 'OK') {
    deleteReviewLog(item.reviewLog.id, storagePath);
    treeProvider.refresh();
    vscode.window.showInformationMessage('File removed from review session.');
  }
}
