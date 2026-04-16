/**
 * SVN Audit Assistant — VS Code Extension Entry Point
 *
 * Registers all commands, views, providers, and initializes the database.
 * Supports both standalone (SQLite) and server (MongoDB) modes.
 */

import * as vscode from 'vscode';
import { SvnService } from './svn/svnService';
import { initDatabase, closeDatabase } from './storage/database';
import { AuditTreeDataProvider } from './ui/auditTreeProvider';
import { SvnContentProvider } from './ui/svnContentProvider';
import { DiffViewManager } from './ui/diffViewManager';
import { newSessionCommand } from './commands/newSession';
import { addCommentCommand } from './commands/addComment';
import { markReviewedCommand, markFlaggedCommand } from './commands/markReviewed';
import { exportReportCommand } from './commands/exportReport';
import { renameSessionCommand } from './commands/renameSession';
import { addAuthorCommand } from './commands/addAuthor';
import { deleteAuthorCommand } from './commands/deleteAuthor';
import { exportAuthorReportCommand } from './commands/exportAuthorReport';
import { summarizeAuthorCommand } from './commands/summarizeAuthor';
import { aiAuditCommand } from './commands/aiAudit';
import { settingsCommand } from './commands/settingsCommand';
import { editCommentCommand, deleteCommentCommand } from './commands/commentActions';
import { jumpToSourceCommand } from './commands/jumpToSource';
import { editSummaryCommand } from './commands/editSummary';
import { deleteFileCommand } from './commands/deleteFile';
import { syncSessionCommand } from './commands/syncSession';
import { AuditTreeItem } from './ui/auditTreeProvider';
import { getLocalization } from './ui/localization';
import { StorageContext } from './storage/storageContext';
import { LocalStorageProvider } from './storage/localStorageProvider';
import { RemoteStorageProvider } from './storage/remoteStorageProvider';
import { AuthManager } from './auth/authManager';
import { createLoginPanel, LoginResult } from './ui/loginPanel';
import { createUserManagementPanel } from './ui/userManagementPanel';
import { ReviewLog, ReviewComment } from './svn/types';

let storagePath: string;
let authManager: AuthManager;
let treeProvider: AuditTreeDataProvider;
let svnService: SvnService;
let diffManager: DiffViewManager;
let contentProvider: SvnContentProvider;

let authSpecificPanels: vscode.WebviewPanel[] = [];

function registerAuthPanel(panel: vscode.WebviewPanel) {
  authSpecificPanels.push(panel);
  panel.onDidDispose(() => {
    authSpecificPanels = authSpecificPanels.filter(p => p !== panel);
  });
}

function disposeAuthPanels() {
  authSpecificPanels.forEach(p => p.dispose());
  authSpecificPanels = [];
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[SVN Audit] Activating extension...');

  // --- Initialize SVN Service ---
  svnService = new SvnService();
  const svnAvailable = await svnService.checkAvailable();
  if (!svnAvailable) {
    console.warn('[SVN Audit] SVN not found in PATH.');
  }

  // --- Initialize Auth Manager ---
  authManager = new AuthManager(context);
  storagePath = context.globalStorageUri.fsPath;

  // --- Register TreeView ---
  treeProvider = new AuditTreeDataProvider();
  const treeView = vscode.window.createTreeView('svnAuditSidebar', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // --- Register Virtual Document Provider ---
  contentProvider = new SvnContentProvider(svnService);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('svn-audit', contentProvider)
  );

  // --- Register Diff View Manager ---
  diffManager = new DiffViewManager(treeView, treeProvider);

  // --- Register Commands ---

  // Login
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.login', () =>
      showLoginPanel(context, treeProvider)
    ),
    vscode.commands.registerCommand('svnAudit.login.zh', () =>
      showLoginPanel(context, treeProvider)
    )
  );

  // Logout
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.logout', async () => {
      const settings = await getSettingsSafe();
      const L = getLocalization(settings?.language);
      const confirm = await vscode.window.showWarningMessage(
        L.logoutConfirm,
        { modal: true },
        'OK'
      );
      if (confirm === 'OK') {
        disposeAuthPanels();
        await authManager.logout();
        StorageContext.clearProvider();
        closeDatabase();
        updateAuthContext();
        treeProvider.refresh();
        vscode.window.showInformationMessage(L.logout);
      }
    }),
    vscode.commands.registerCommand('svnAudit.logout.zh', () =>
      vscode.commands.executeCommand('svnAudit.logout')
    )
  );

  // User Management
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.userManagement', async () => {
      const state = authManager.getAuthState();
      if (state.mode === 'server' && state.serverUrl && state.token) {
        const settings = await getSettingsSafe();
        const panel = createUserManagementPanel(
          context.extensionUri,
          state.serverUrl,
          state.token,
          settings?.language
        );
        registerAuthPanel(panel);
      }
    }),
    vscode.commands.registerCommand('svnAudit.userManagement.zh', () =>
      vscode.commands.executeCommand('svnAudit.userManagement')
    )
  );

  // New Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.newSession', async () => {
      const panel = await newSessionCommand(context.extensionUri, svnService, treeProvider, treeView, storagePath);
      if (panel) { registerAuthPanel(panel); }
    })
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
    vscode.commands.registerCommand('svnAudit.exportReport', () => exportReportCommand(storagePath)),
    vscode.commands.registerCommand('svnAudit.exportReport.zh', () => exportReportCommand(storagePath))
  );

  // Add Comment (editor context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.addComment', () => addCommentCommand(treeProvider, storagePath, diffManager)),
    vscode.commands.registerCommand('svnAudit.addComment.zh', () => addCommentCommand(treeProvider, storagePath, diffManager))
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

  // Delete File
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteFile', (item: AuditTreeItem) =>
      deleteFileCommand(item, treeProvider, storagePath)
    )
  );

  // Open Diff View
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.openDiff', (reviewLog: ReviewLog, comment?: ReviewComment) =>
      diffManager.openDiffView(reviewLog, comment)
    )
  );

  // Delete Session
  async function deleteSession(item: AuditTreeItem) {
    if (!item?.sessionId) { return; }
    const confirm = await vscode.window.showWarningMessage(
      `Delete this audit session? This will remove all review logs and comments.`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      const provider = StorageContext.getProvider();
      await provider.deleteSession(item.sessionId);
      treeProvider.refresh();
      vscode.window.showInformationMessage('Session deleted.');
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteSession', (item: AuditTreeItem) => deleteSession(item)),
    vscode.commands.registerCommand('svnAudit.deleteSession.zh', async (item: AuditTreeItem) => {
      if (!item?.sessionId) { return; }
      const settings = await getSettingsSafe();
      const L = getLocalization(settings?.language);
      const confirm = await vscode.window.showWarningMessage(
        L.deleteConfirm,
        { modal: true },
        'OK'
      );
      if (confirm === 'OK') {
        const provider = StorageContext.getProvider();
        await provider.deleteSession(item.sessionId);
        treeProvider.refresh();
        vscode.window.showInformationMessage(L.modelDeleted);
      }
    })
  );

  // Edit/Delete Comment
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.editComment', (item: AuditTreeItem) => editCommentCommand(item, treeProvider, storagePath, diffManager)),
    vscode.commands.registerCommand('svnAudit.editComment.zh', (item: AuditTreeItem) => editCommentCommand(item, treeProvider, storagePath, diffManager))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteComment', (item: AuditTreeItem) => deleteCommentCommand(item, treeProvider, storagePath, diffManager)),
    vscode.commands.registerCommand('svnAudit.deleteComment.zh', (item: AuditTreeItem) => deleteCommentCommand(item, treeProvider, storagePath, diffManager))
  );

  // Rename Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.renameSession', (node: AuditTreeItem) => renameSessionCommand(node, treeProvider, storagePath)),
    vscode.commands.registerCommand('svnAudit.renameSession.zh', (node: AuditTreeItem) => renameSessionCommand(node, treeProvider, storagePath))
  );

  // Sync Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.syncSession', (item: AuditTreeItem) => syncSessionCommand(item, svnService, treeProvider)),
    vscode.commands.registerCommand('svnAudit.syncSession.zh', (item: AuditTreeItem) => syncSessionCommand(item, svnService, treeProvider))
  );

  // Add Author to Session
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.addAuthorToSession', (node: AuditTreeItem) => addAuthorCommand(node, svnService, treeProvider, storagePath)),
    vscode.commands.registerCommand('svnAudit.addAuthorToSession.zh', (node: AuditTreeItem) => addAuthorCommand(node, svnService, treeProvider, storagePath))
  );

  // Author specific commands
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.deleteAuthor', (item: AuditTreeItem) =>
      deleteAuthorCommand(item, treeProvider, storagePath)
    ),
    vscode.commands.registerCommand('svnAudit.deleteAuthor.zh', (item: AuditTreeItem) =>
      deleteAuthorCommand(item, treeProvider, storagePath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.exportAuthorReport', (item: AuditTreeItem) => exportAuthorReportCommand(item)),
    vscode.commands.registerCommand('svnAudit.exportAuthorReport.zh', (item: AuditTreeItem) => exportAuthorReportCommand(item))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.summarizeAuthor', (item: AuditTreeItem) => summarizeAuthorCommand(item, svnService)),
    vscode.commands.registerCommand('svnAudit.summarizeAuthor.zh', (item: AuditTreeItem) => summarizeAuthorCommand(item, svnService))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.editSummary', (item: AuditTreeItem) => editSummaryCommand(item, treeProvider, storagePath, context.extensionUri)),
    vscode.commands.registerCommand('svnAudit.editSummary.zh', (item: AuditTreeItem) => editSummaryCommand(item, treeProvider, storagePath, context.extensionUri))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.aiAudit', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false)),
    vscode.commands.registerCommand('svnAudit.aiAudit.zh', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false)),
    vscode.commands.registerCommand('svnAudit.aiAuditSelectModel', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, true, false)),
    vscode.commands.registerCommand('svnAudit.aiAuditSelectModel.zh', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, true, false)),
    vscode.commands.registerCommand('svnAudit.aiAuditForce', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, true)),
    vscode.commands.registerCommand('svnAudit.aiAuditForce.zh', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, true)),
    vscode.commands.registerCommand('svnAudit.aiAuditFull', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, false, true)),
    vscode.commands.registerCommand('svnAudit.aiAuditFull.zh', (item: AuditTreeItem) => aiAuditCommand(item, svnService, treeProvider, diffManager, storagePath, false, false, true))
  );

  // Jump to Source
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.jumpToSource', () => jumpToSourceCommand(svnService)),
    vscode.commands.registerCommand('svnAudit.jumpToSource.zh', () => jumpToSourceCommand(svnService))
  );

  // Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.openSettings', async () => {
      const panel = await settingsCommand(context.extensionUri, storagePath);
      if (panel) { registerAuthPanel(panel); }
    }),
    vscode.commands.registerCommand('svnAudit.openSettings.zh', () => vscode.commands.executeCommand('svnAudit.openSettings'))
  );

  // New Session / Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.newSession.zh', () => vscode.commands.executeCommand('svnAudit.newSession')),
    vscode.commands.registerCommand('svnAudit.refresh.zh', () => {
      contentProvider.clearCache();
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svnAudit.markReviewed.zh', (item: AuditTreeItem) => markReviewedCommand(item, treeProvider, storagePath)),
    vscode.commands.registerCommand('svnAudit.markFlagged.zh', (item: AuditTreeItem) => markFlaggedCommand(item, treeProvider, storagePath)),
    vscode.commands.registerCommand('svnAudit.deleteFile.zh', (item: AuditTreeItem) => deleteFileCommand(item, treeProvider, storagePath))
  );

  // --- Initial State ---

  // Set initial auth context (not logged in)
  updateAuthContext();

  // Try to auto-login with saved credentials, otherwise show login prompt
  const saved = await authManager.loadSavedCredentials();
  if (saved && saved.password) {
    try {
      await authManager.login(saved.serverUrl, saved.username, saved.password);
      const state = authManager.getAuthState();
      const remoteProvider = new RemoteStorageProvider(state.serverUrl!, state.token!);
      StorageContext.setProvider(remoteProvider);
      updateAuthContext();
      await updateLanguageContext();
      treeProvider.refresh();
      console.log('[SVN Audit] Auto-login successful');
    } catch {
      // Auto-login failed, user needs to login manually
      console.log('[SVN Audit] Auto-login failed, waiting for manual login');
      updateAuthContext();
    }
  }

  console.log('[SVN Audit] Extension activated successfully.');
}

/**
 * Show login panel and handle the result.
 */
async function showLoginPanel(
  context: vscode.ExtensionContext,
  treeProvider: AuditTreeDataProvider
): Promise<void> {
  const saved = await authManager.loadSavedCredentials();

  const panel = createLoginPanel(
    context.extensionUri,
    async (result: LoginResult) => {
      try {
        if (result.mode === 'standalone') {
          // --- Standalone Mode ---
          authManager.enterStandaloneMode();

          await initDatabase(storagePath);
          const localProvider = new LocalStorageProvider(storagePath);
          StorageContext.setProvider(localProvider);
          updateAuthContext();
          await updateLanguageContext();
          treeProvider.refresh();

          console.log('[SVN Audit] Entered standalone mode');
          panel.dispose();

        } else if (result.mode === 'login') {
          // --- Server Login ---
          const state = await authManager.login(result.serverUrl!, result.username!, result.password!);
          await authManager.saveCredentials(result.serverUrl!, result.username!, result.password!);
          const remoteProvider = new RemoteStorageProvider(state.serverUrl!, state.token!);
          StorageContext.setProvider(remoteProvider);
          updateAuthContext();
          await updateLanguageContext();
          treeProvider.refresh();

          console.log(`[SVN Audit] Logged in as ${state.username} Roles: ${JSON.stringify(state.roles)}`);

          const settings = await getSettingsSafe();
          const L = getLocalization(settings?.language);
          vscode.window.showInformationMessage(L.loginSuccess);
          panel.dispose();

        } else if (result.mode === 'register') {
          // --- Register ---
          await authManager.register(result.serverUrl!, result.username!, result.password!);
          await authManager.saveCredentials(result.serverUrl!, result.username!, result.password!);
          const settings = await getSettingsSafe();
          const L = getLocalization(settings?.language);
          vscode.window.showInformationMessage(L.registerSuccess);
          // Don't close panel — user can now login
        }
      } catch (err: any) {
        panel.webview.postMessage({ command: 'error', message: err.message });
        vscode.window.showErrorMessage(`${err.message}`);
      }
    },
    saved || undefined
  );
}

/**
 * Update VS Code context keys for conditional UI.
 */
function updateAuthContext(): void {
  const state = authManager.getAuthState();
  const isAuthenticated = authManager.isAuthenticated() && StorageContext.hasProvider();
  const isReviewer = authManager.isReviewer();
  const isServerMode = state.mode === 'server';

  vscode.commands.executeCommand('setContext', 'svnAudit.isLoggedIn', isAuthenticated);
  vscode.commands.executeCommand('setContext', 'svnAudit.isReviewer', isReviewer);
  vscode.commands.executeCommand('setContext', 'svnAudit.isReviewee', authManager.isReviewee());
  vscode.commands.executeCommand('setContext', 'svnAudit.isServerMode', isServerMode);
}

/**
 * Get settings safely (may fail if not initialized).
 */
async function getSettingsSafe(): Promise<any> {
  try {
    if (StorageContext.hasProvider()) {
      return await StorageContext.getProvider().getSettings();
    }
  } catch { /* ignore */ }
  return null;
}

async function updateLanguageContext(): Promise<void> {
  const settings = await getSettingsSafe();
  let lang = settings?.language;
  if (!lang) {
    lang = vscode.env.language.startsWith('zh') ? 'zh' : 'en';
  }
  vscode.commands.executeCommand('setContext', 'svnAudit.isZh', lang === 'zh');
}

export function deactivate(): void {
  closeDatabase();
  console.log('[SVN Audit] Extension deactivated.');
}
