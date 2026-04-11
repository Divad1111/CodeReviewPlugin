/**
 * User management panel — Webview for managing reviewee accounts.
 * Only accessible by reviewer role users in server mode.
 */

import * as vscode from 'vscode';
import { getLocalization } from './localization';
import { RemoteStorageProvider } from '../storage/remoteStorageProvider';

interface UserInfo {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export function createUserManagementPanel(
  extensionUri: vscode.Uri,
  serverUrl: string,
  token: string,
  language?: string
): vscode.WebviewPanel {
  const L = getLocalization(language);

  const panel = vscode.window.createWebviewPanel(
    'svnAuditUserManagement',
    L.userManagement,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  let users: UserInfo[] = [];

  const refresh = async () => {
    try {
      users = await fetchUsers(serverUrl, token);
      panel.webview.html = getUserManagementHtml(L, users);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to load users: ${err.message}`);
    }
  };

  refresh();

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'addUser': {
        const username = await vscode.window.showInputBox({
          prompt: L.newUsername,
          placeHolder: L.username,
        });
        if (!username) { return; }

        const password = await vscode.window.showInputBox({
          prompt: L.newPassword,
          placeHolder: L.password,
          password: true,
        });
        if (!password) { return; }

        try {
          await createUser(serverUrl, token, username, password);
          vscode.window.showInformationMessage(L.userAdded);
          refresh();
        } catch (err: any) {
          vscode.window.showErrorMessage(`${L.errorPrefix}: ${err.message}`);
        }
        break;
      }
      case 'deleteUser': {
        const userId = message.userId;
        const user = users.find(u => u.id === userId);
        if (!user) { return; }

        const confirm = await vscode.window.showWarningMessage(
          `${L.deleteUserConfirm} "${user.username}"?`,
          { modal: true },
          'OK'
        );
        if (confirm === 'OK') {
          try {
            await deleteUser(serverUrl, token, userId);
            vscode.window.showInformationMessage(L.userDeleted);
            refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`${L.errorPrefix}: ${err.message}`);
          }
        }
        break;
      }
      case 'modifyUser': {
        const userId = message.userId;
        const newPassword = await vscode.window.showInputBox({
          prompt: L.newPassword,
          placeHolder: L.password,
          password: true,
        });
        if (!newPassword) { return; }

        try {
          await modifyUser(serverUrl, token, userId, newPassword);
          vscode.window.showInformationMessage(L.userUpdated);
          refresh();
        } catch (err: any) {
          vscode.window.showErrorMessage(`${L.errorPrefix}: ${err.message}`);
        }
        break;
      }
    }
  });

  return panel;
}

function getUserManagementHtml(L: any, users: UserInfo[]): string {
  const userRows = users.map(u => `
    <tr>
      <td>${escapeHtml(u.username)}</td>
      <td>••••••</td>
      <td>
        <button class="btn-small btn-secondary" onclick="modifyUser('${u.id}')">✏️</button>
        <button class="btn-small btn-danger" onclick="deleteUser('${u.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');

  return /*html*/ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${L.userManagement}</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 20px; }
    h1 { font-size: 1.4em; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
    h1::before { content: '👥'; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border); }
    th { font-weight: 600; opacity: 0.8; font-size: 0.9em; }
    tr:hover { background: var(--vscode-list-hoverBackground); }
    .btn-group { display: flex; gap: 8px; margin-top: 16px; }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.85; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-danger { background: #d73a49; color: white; }
    .btn-small { padding: 4px 8px; font-size: 12px; }
    .empty-msg { text-align: center; padding: 40px; opacity: 0.6; }
  </style>
</head>
<body>
  <h1>${L.userManagement}</h1>
  
  ${users.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>${L.username}</th>
          <th>${L.password}</th>
          <th>${L.actions}</th>
        </tr>
      </thead>
      <tbody>
        ${userRows}
      </tbody>
    </table>
  ` : `
    <div class="empty-msg">${L.noUsers}</div>
  `}
  
  <div class="btn-group">
    <button class="btn-primary" onclick="addUser()">${L.addUser}</button>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function addUser() {
      vscode.postMessage({ command: 'addUser' });
    }
    
    function deleteUser(userId) {
      vscode.postMessage({ command: 'deleteUser', userId });
    }
    
    function modifyUser(userId) {
      vscode.postMessage({ command: 'modifyUser', userId });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- HTTP helpers ---
import * as http from 'http';
import * as https from 'https';

function apiRequest<T>(method: string, url: string, token: string, body?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            const parsed = data ? JSON.parse(data) : {};
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            return;
          }
          resolve(data ? JSON.parse(data) : null);
        } catch (e) {
          reject(new Error(`Failed to parse: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) { req.write(bodyStr); }
    req.end();
  });
}

async function fetchUsers(serverUrl: string, token: string): Promise<UserInfo[]> {
  return apiRequest<UserInfo[]>('GET', `${serverUrl}/api/users`, token);
}

async function createUser(serverUrl: string, token: string, username: string, password: string): Promise<void> {
  await apiRequest('POST', `${serverUrl}/api/users`, token, { username, password });
}

async function deleteUser(serverUrl: string, token: string, userId: string): Promise<void> {
  await apiRequest('DELETE', `${serverUrl}/api/users/${userId}`, token);
}

async function modifyUser(serverUrl: string, token: string, userId: string, password: string): Promise<void> {
  await apiRequest('PUT', `${serverUrl}/api/users/${userId}`, token, { password });
}
