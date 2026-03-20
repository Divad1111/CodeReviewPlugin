/**
 * SVN Audit Assistant — VS Code Extension Entry Point
 *
 * Registers all commands, views, providers, and initializes the database.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SvnService } from './svn/svnService';
import { initDatabase, closeDatabase } from './storage/database';
import { AuditTreeDataProvider } from './ui/auditTreeProvider';
import { SvnContentProvider } from './ui/svnContentProvider';
import { DiffViewManager } from './ui/diffViewManager';
import { newSessionCommand } from './commands/newSession';
import { addCommentCommand } from './commands/addComment';
import { markReviewedCommand, markFlaggedCommand } from './commands/markReviewed';
import { exportReportCommand } from './commands/exportReport';
import { deleteSession } from './storage/sessionRepo';
import { ReviewLog } from './svn/types';
import { AuditTreeItem } from './ui/auditTreeProvider';

let storagePath: string;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[SVN Audit] Activating extension...');

  // --- Initialize SVN Service ---
  const svnService = new SvnService();
  const svnAvailable = await svnService.checkSvn();
  if (!svnAvailable) {
    // Show the sidebar anyway, but functionality will be limited
    console.warn('[SVN Audit] SVN not found in PATH.');
  }

  // --- Initialize Database ---
  storagePath = context.globalStorageUri.fsPath;
  try {
    await initDatabase(storagePath);
    console.log('[SVN Audit] Database initialized at:', storagePath);
  } catch (err: any) {
    vscode.window.showErrorMessage(`SVN Audit: Failed to initialize database — ${err.message}`);
    return;
  }

  // --- Register TreeView ---
  const treeProvider = new AuditTreeDataProvider();
  const treeView = vscode.window.createTreeView('svnAuditSidebar', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // --- Register Virtual Document Provider ---
  const contentProvider = new SvnContentProvider(svnService);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('svn-audit', contentProvider)
  );

  // --- Register Diff View Manager ---
  const diffManager = new DiffViewManager();

  // --- Register Commands ---

  // New Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.newSession', () =>
      newSessionCommand(context.extensionUri, svnService, treeProvider, storagePath)
    )
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.refresh', () => {
      contentProvider.clearCache();
      treeProvider.refresh();
    })
  );

  // Export Report
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.exportReport', () =>
      exportReportCommand(storagePath)
    )
  );

  // Add Comment (editor context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.addComment', () =>
      addCommentCommand(treeProvider, storagePath)
    )
  );

  // Mark as Reviewed
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.markReviewed', (item: AuditTreeItem) =>
      markReviewedCommand(item, treeProvider, storagePath)
    )
  );

  // Mark as Flagged
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.markFlagged', (item: AuditTreeItem) =>
      markFlaggedCommand(item, treeProvider, storagePath)
    )
  );

  // Open Diff View
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.openDiff', (reviewLog: ReviewLog) =>
      diffManager.openDiffView(reviewLog)
    )
  );

  // Delete Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteSession', async (item: AuditTreeItem) => {
      if (!item?.sessionId) {return;}
      const confirm = await vscode.window.showWarningMessage(
        `Delete this audit session? This will remove all review logs and comments.`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        deleteSession(item.sessionId, storagePath);
        treeProvider.refresh();
        vscode.window.showInformationMessage('Session deleted.');
      }
    })
  );

  console.log('[SVN Audit] Extension activated successfully.');
}

export function deactivate(): void {
  closeDatabase();
  console.log('[SVN Audit] Extension deactivated.');
}
