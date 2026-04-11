/**
 * Command: Mark file as Reviewed (approved or flagged).
 */

import * as vscode from 'vscode';
import { updateReviewStatus } from '../storage/reviewRepo';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { ReviewLog } from '../svn/types';

export async function markReviewedCommand(
  item: AuditTreeItem | undefined,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  if (!item?.reviewLog) {
    vscode.window.showWarningMessage('Please select a file from the SVN Audit sidebar.');
    return;
  }

  updateReviewStatus(item.reviewLog.id, 'approved', storagePath);
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

  updateReviewStatus(item.reviewLog.id, 'flagged', storagePath);
  treeProvider.refresh();
  vscode.window.showInformationMessage(`❌ Marked "${item.label}" as flagged.`);
}
