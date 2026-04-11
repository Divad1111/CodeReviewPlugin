/**
 * Command: Mark file as Reviewed (approved or flagged).
 */

import * as vscode from 'vscode';
import { StorageContext } from '../storage/storageContext';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';

export async function markReviewedCommand(
  item: AuditTreeItem | undefined,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  if (!item?.reviewLog) {
    vscode.window.showWarningMessage('Please select a file from the SVN Audit sidebar.');
    return;
  }

  const provider = StorageContext.getProvider();
  await provider.updateReviewStatus(item.reviewLog.id, 'approved');
  treeProvider.refresh();
  vscode.window.showInformationMessage(`✅ Marked "${item.label}" as approved.`);
}

export async function markFlaggedCommand(
  item: AuditTreeItem | undefined,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  if (!item?.reviewLog) {
    vscode.window.showWarningMessage('Please select a file from the SVN Audit sidebar.');
    return;
  }

  const provider = StorageContext.getProvider();
  await provider.updateReviewStatus(item.reviewLog.id, 'flagged');
  treeProvider.refresh();
  vscode.window.showInformationMessage(`❌ Marked "${item.label}" as flagged.`);
}
