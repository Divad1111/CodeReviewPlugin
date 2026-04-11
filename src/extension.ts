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
import { renameSessionCommand } from './commands/renameSession';
import { addAuthorCommand } from './commands/addAuthor';
import { deleteAuthorCommand } from './commands/deleteAuthor';
import { exportAuthorReportCommand } from './commands/exportAuthorReport';
import { summarizeAuthorCommand } from './commands/summarizeAuthor';
import { aiAuditCommand } from './commands/aiAudit';
import { settingsCommand } from './commands/settingsCommand';
import { editCommentCommand, deleteCommentCommand } from './commands/commentActions';
import { jumpToSourceCommand } from './commands/jumpToSource';
import { ReviewLog, ReviewComment } from './svn/types';
import { AuditTreeItem } from './ui/auditTreeProvider';
import { getSettings } from './storage/settingsRepo';
import { getLocalization } from './ui/localization';

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
  const diffManager = new DiffViewManager(treeView, treeProvider);

  // --- Register Commands ---

  // New Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.newSession', () =>
      newSessionCommand(context.extensionUri, svnService, treeProvider, treeView, storagePath)
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
      addCommentCommand(treeProvider, storagePath, diffManager)
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
    vscode.commands.registerCommand('svnAudit.openDiff', (reviewLog: ReviewLog, comment?: ReviewComment) =>
      diffManager.openDiffView(reviewLog, comment)
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

  // Edit/Delete Comment
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.editComment', (item: AuditTreeItem) =>
      editCommentCommand(item, treeProvider, storagePath, diffManager)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteComment', (item: AuditTreeItem) =>
      deleteCommentCommand(item, treeProvider, storagePath, diffManager)
    )
  );

  // Rename Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.renameSession', (node) =>
      renameSessionCommand(node, treeProvider, storagePath)
    )
  );

  // Add Author to Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.addAuthorToSession', (node: AuditTreeItem) =>
      addAuthorCommand(node, svnService, treeProvider, storagePath)
    )
  );

  // Author specific commands
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteAuthor', (item: AuditTreeItem) =>
      deleteAuthorCommand(item, treeProvider, storagePath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.exportAuthorReport', (item: AuditTreeItem) =>
      exportAuthorReportCommand(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.summarizeAuthor', (item: AuditTreeItem) =>
      summarizeAuthorCommand(item, svnService)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.aiAudit', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.aiAuditSelectModel', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, true, false)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.aiAuditForce', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, true)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.aiAuditFull', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, false, true)
    )
  );

  // Jump to Source
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.jumpToSource', () =>
      jumpToSourceCommand(svnService)
    )
  );

  // Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.openSettings', () =>
      settingsCommand(context.extensionUri, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.openSettings.zh', () =>
      settingsCommand(context.extensionUri, storagePath)
    )
  );

  // --- Shadow Command Registrations for ZH support ---
  // These allow us to have localized titles/tooltips that follow our internal setting
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.newSession.zh', () =>
      newSessionCommand(context.extensionUri, svnService, treeProvider, treeView, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.refresh.zh', () => {
      contentProvider.clearCache();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('svnAudit.exportReport.zh', () =>
      exportReportCommand(storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.aiAudit.zh', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false)
    ),
    vscode.commands.registerCommand('svnAudit.aiAuditSelectModel.zh', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, true, false)
    ),
    vscode.commands.registerCommand('svnAudit.aiAuditForce.zh', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, true)
    ),
    vscode.commands.registerCommand('svnAudit.aiAuditFull.zh', (item: AuditTreeItem) =>
      aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, false, true)
    ),
    vscode.commands.registerCommand('svnAudit.markReviewed.zh', (item: AuditTreeItem) =>
      markReviewedCommand(item, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.markFlagged.zh', (item: AuditTreeItem) =>
      markFlaggedCommand(item, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.addAuthorToSession.zh', (node: AuditTreeItem) =>
      addAuthorCommand(node, svnService, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.renameSession.zh', (node) =>
      renameSessionCommand(node, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.deleteSession.zh', async (item: AuditTreeItem) => {
      if (!item?.sessionId) {return;}
      const settings = getSettings();
      const L = getLocalization(settings.language);
      const confirm = await vscode.window.showWarningMessage(
        L.deleteConfirm,
        { modal: true },
        'OK'
      );
      if (confirm === 'OK') {
        deleteSession(item.sessionId, storagePath);
        treeProvider.refresh();
        vscode.window.showInformationMessage(L.modelDeleted);
      }
    }),
    vscode.commands.registerCommand('svnAudit.addComment.zh', () =>
      addCommentCommand(treeProvider, storagePath, diffManager)
    ),
    vscode.commands.registerCommand('svnAudit.exportAuthorReport.zh', (item: AuditTreeItem) =>
      exportAuthorReportCommand(item)
    ),
    vscode.commands.registerCommand('svnAudit.summarizeAuthor.zh', (item: AuditTreeItem) =>
      summarizeAuthorCommand(item, svnService)
    ),
    vscode.commands.registerCommand('svnAudit.deleteAuthor.zh', (item: AuditTreeItem) =>
      deleteAuthorCommand(item, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.editComment.zh', (item: AuditTreeItem) =>
      editCommentCommand(item, treeProvider, storagePath, diffManager)
    ),
    vscode.commands.registerCommand('svnAudit.deleteComment.zh', (item: AuditTreeItem) =>
      deleteCommentCommand(item, treeProvider, storagePath, diffManager)
    ),
    vscode.commands.registerCommand('svnAudit.jumpToSource.zh', () =>
      jumpToSourceCommand(svnService)
    )
  );

  // --- Initial Context & Refresh ---
  updateLanguageContext();
  treeProvider.refresh();

  console.log('[SVN Audit] Extension activated successfully.');
}

function updateLanguageContext(): void {
  const settings = getSettings();
  let lang = settings.language;
  if (!lang) {
    lang = vscode.env.language.startsWith('zh') ? 'zh' : 'en';
  }
  vscode.commands.executeCommand('setContext', 'svnAudit.isZh', lang === 'zh');
}

export function deactivate(): void {
  closeDatabase();
  console.log('[SVN Audit] Extension deactivated.');
}
