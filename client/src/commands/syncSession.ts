/**
 * Command: Sync Session with SVN
 * Re-fetches SVN logs for the session's date range and adds any missing records.
 */

import * as vscode from 'vscode';
import { SvnService } from '../svn/svnService';
import { aggregateByAuthor } from '../svn/mergeAlgorithm';
import { StorageContext } from '../storage/storageContext';
import { AuditTreeDataProvider, AuditTreeItem } from '../ui/auditTreeProvider';
import { getLocalization } from '../ui/localization';

export async function syncSessionCommand(
  item: AuditTreeItem,
  svnService: SvnService,
  treeProvider: AuditTreeDataProvider
): Promise<void> {
  const sessionId = item.sessionId;
  if (!sessionId) { return; }

  const provider = StorageContext.getProvider();
  const session = await provider.getSessionById(sessionId);
  if (!session) { return; }

  const providerSettings = await provider.getSettings();
  const L = getLocalization(providerSettings.language);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${L.fetchingLogs || 'SVN Audit: Syncing with SVN...'}`,
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Querying SVN log...', increment: 10 });

        const logEntries = await svnService.getLog(session.repoUrl, session.startDate, session.endDate);

        if (logEntries.length === 0) {
          vscode.window.showInformationMessage('No new changes found in SVN for this period.');
          return;
        }

        progress.report({ message: 'Analyzing missing changes...', increment: 40 });

        // Aggregate by author
        const authorMap = aggregateByAuthor(logEntries, session.authors);

        if (authorMap.size === 0) {
          vscode.window.showInformationMessage('All changes from SVN are already in this session.');
          return;
        }

        progress.report({ message: 'Updating session data...', increment: 30 });

        let newFileCount = 0;
        // Create review logs for each author's files (upsert will handle duplicates)
        for (const [, changes] of authorMap) {
          for (const file of changes.files) {
            await provider.upsertReviewLog(
              session.id,
              file.path,
              changes.author,
              changes.baseRevision,
              changes.endRevision
            );
            newFileCount++;
          }
        }

        progress.report({ message: 'Done!', increment: 20 });

        // Refresh tree
        treeProvider.refresh();

        vscode.window.showInformationMessage(`Sync complete: Checked ${logEntries.length} SVN revisions. New data merged.`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
      }
    }
  );
}
