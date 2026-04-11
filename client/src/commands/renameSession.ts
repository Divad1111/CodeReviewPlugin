import * as vscode from 'vscode';
import { AuditTreeItem, AuditTreeDataProvider } from '../ui/auditTreeProvider';
import { StorageContext } from '../storage/storageContext';

export async function renameSessionCommand(
  node: AuditTreeItem,
  treeProvider: AuditTreeDataProvider,
  storagePath: string
): Promise<void> {
  if (!node || node.itemType !== 'session' || !node.sessionId) {
    return;
  }

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(node.sessionId);
  if (!session) {
    return;
  }

  const newName = await vscode.window.showInputBox({
    prompt: 'Enter new name for the session',
    value: session.name,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Session name cannot be empty';
      }
      return null;
    }
  });

  if (newName !== undefined && newName.trim().length > 0 && newName.trim() !== session.name) {
    await provider.renameSession(session.id, newName.trim());
    vscode.window.showInformationMessage(`Session renamed to "${newName.trim()}"`);
    treeProvider.refresh();
  }
}
