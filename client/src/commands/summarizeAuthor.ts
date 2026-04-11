/**
 * Command: Summarize Author Work
 * Fetches SVN logs for the author, deduplicates the messages, and exports as Markdown.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { SvnService } from '../svn/svnService';
import { StorageContext } from '../storage/storageContext';
import { AuditTreeItem } from '../ui/auditTreeProvider';

export async function summarizeAuthorCommand(
  item: AuditTreeItem,
  svnService: SvnService
): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) {return;}

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(sessionId);
  if (!session) {return;}

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `SVN Audit: Summarizing work for ${author}...`,
    },
    async () => {
      try {
        const logs = await svnService.getLogsForAuthor(session.repoUrl, session.startDate, session.endDate, author);
        
        if (logs.length === 0) {
          vscode.window.showInformationMessage(`No SVN logs found for ${author} in this session.`);
          return;
        }

        // Deduplicate messages + clean up
        const messages = Array.from(new Set(logs.map(l => l.message.trim()))).filter(m => m.length > 0);

        const lines: string[] = [];
        lines.push(`# Work Summary: ${author}`);
        lines.push(`## Session: ${session.name}`);
        lines.push(`Period: ${session.startDate} — ${session.endDate}`);
        lines.push('');
        lines.push(`### Commit Messages (${messages.length})`);
        lines.push('');
        messages.forEach((msg, i) => {
          lines.push(`${i + 1}. ${msg}`);
        });

        const markdown = lines.join('\n');

        // Export dialog
        const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const saveUri = await vscode.window.showSaveDialog({
          title: 'Export Work Summary',
          defaultUri: defaultUri
            ? vscode.Uri.joinPath(defaultUri, `summary_${author}_${new Date().toISOString().split('T')[0]}.md`)
            : undefined,
          filters: { 'Markdown': ['md'] },
        });

        if (saveUri) {
          fs.writeFileSync(saveUri.fsPath, markdown);
          const doc = await vscode.workspace.openTextDocument(saveUri);
          await vscode.window.showTextDocument(doc, { preview: false });
          vscode.window.showInformationMessage(`Summary exported to ${saveUri.fsPath}`);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to summarize: ${err.message}`);
      }
    }
  );
}
