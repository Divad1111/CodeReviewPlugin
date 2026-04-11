/**
 * Command: Edit Review Summary
 * Opens a webview panel to edit the author-specific review summary.
 */

import * as vscode from 'vscode';
import { AuditTreeItem, AuditTreeDataProvider } from '../ui/auditTreeProvider';
import { StorageContext } from '../storage/storageContext';
import { createSummaryPanel } from '../ui/summaryPanel';

export async function editSummaryCommand(
  item: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string,
  extensionUri: vscode.Uri
): Promise<void> {
  if (!item.sessionId || !item.author) {
    vscode.window.showErrorMessage('Invalid selection: Session or Author missing.');
    return;
  }

  const provider = StorageContext.getProvider();
  const existing = await provider.getSummary(item.sessionId, item.author);
  const initialText = existing ? existing.summary : '';

  createSummaryPanel(
    extensionUri,
    item.author,
    initialText,
    async (newSummary) => {
      if (!item.sessionId || !item.author) {return;}
      
      await provider.upsertSummary(item.sessionId, item.author, newSummary);
      
      // Clear cache for this node to force update in tree
      const cacheKey = `summary:${item.sessionId}:${item.author}`;
      (treeProvider as any).itemCache?.delete(cacheKey);
      
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Review summary updated for ${item.author}.`);
    }
  );
}
