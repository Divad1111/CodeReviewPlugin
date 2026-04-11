/**
 * User management panel — Webview for managing accounts with a dedicated Edit View.
 */

import * as vscode from 'vscode';
import { getLocalization } from './localization';

interface UserInfo {
  id: string;
  username: string;
  roles: string[];
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

  let currentUserList: UserInfo[] = [];

  const refresh = async () => {
    try {
      currentUserList = (await fetchUsers(serverUrl, token)) || [];
      console.log('Fetched users data:', currentUserList); // 调试日志，请在开发者工具查看
      renderMain(panel, L, currentUserList);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to load users: ${err.message}`);
    }
  };

  refresh();

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'refresh':
        refresh();
        break;
      case 'showAddUser':
        renderEdit(panel, L, null);
        break;
      case 'showEditUser': {
        const user = currentUserList.find(u => u.id === message.userId);
        if (user) {
          renderEdit(panel, L, user);
        }
        break;
      }
      case 'saveUser': {
        try {
          const { id, username, password, roles } = message.data;
          if (id) {
            // Modify
            await modifyUser(serverUrl, token, id, password || undefined, roles);
            vscode.window.showInformationMessage(L.userUpdated);
          } else {
            // Create
            if (!username || !password) {
              vscode.window.showErrorMessage(L.usernameRequired);
              return;
            }
            await createUser(serverUrl, token, username, password, roles);
            vscode.window.showInformationMessage(L.userAdded);
          }
          refresh();
        } catch (err: any) {
          vscode.window.showErrorMessage(`${L.errorPrefix}: ${err.message}`);
        }
        break;
      }
      case 'deleteUser': {
        const user = currentUserList.find(u => u.id === message.userId);
        if (!user) { return; }
        const confirm = await vscode.window.showWarningMessage(
          `${L.deleteUserConfirm} "${user.username}"?`,
          { modal: true },
          'OK'
        );
        if (confirm === 'OK') {
          try {
            await deleteUser(serverUrl, token, user.id);
            vscode.window.showInformationMessage(L.userDeleted);
            refresh();
          } catch (err: any) {
            vscode.window.showErrorMessage(`${L.errorPrefix}: ${err.message}`);
          }
        }
        break;
      }
      case 'cancel':
        renderMain(panel, L, currentUserList);
        break;
    }
  });

  return panel;
}

function renderMain(panel: vscode.WebviewPanel, L: any, users: UserInfo[]) {
  panel.webview.html = getHtml(L, `
    <div class="header-row">
       <h1>${L.userManagement}</h1>
       <button class="btn-primary" onclick="addUser()">${L.addUser}</button>
    </div>
    
    ${users.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>${L.username}</th>
            <th>${L.permissions || 'Permissions'}</th>
            <th style="width: 100px;">${L.actions}</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><span class="user-name">${escapeHtml(u.username)}</span></td>
              <td>
                ${(u.roles && u.roles.length > 0) ? u.roles.join(', ') : (L.reviewee || 'Reviewee')}
              </td>
              <td class="actions-cell">
                <button title="${L.edit}" onclick="editUser('${u.id}')">✏️</button>
                <button class="danger" title="${L.delete}" onclick="deleteUser('${u.id}')">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `<div class="empty-msg">${L.noUsers}</div>`}
    
    <script>
      function addUser() { vscode.postMessage({ command: 'showAddUser' }); }
      function editUser(id) { vscode.postMessage({ command: 'showEditUser', userId: id }); }
      function deleteUser(id) { vscode.postMessage({ command: 'deleteUser', userId: id }); }
    </script>
  `);
}

function renderEdit(panel: vscode.WebviewPanel, L: any, user: UserInfo | null) {
  const isEdit = !!user;
  panel.webview.html = getHtml(L, `
    <h1>${isEdit ? L.modifyUser : L.addUser}</h1>
    
    <div class="form-container">
      <div class="form-group">
        <label>${L.username}</label>
        <input type="text" id="username" value="${user ? escapeHtml(user.username) : ''}" ${isEdit ? 'disabled' : ''} />
      </div>
      
      <div class="form-group">
        <label>${isEdit ? L.newPassword + ' (' + L.optional + ')' : L.password}</label>
        <input type="password" id="password" placeholder="${isEdit ? '********' : ''}" />
      </div>
      
      <div class="form-group">
        <label>${L.permissions || 'Permissions'}</label>
        <div class="checkbox-group">
           <label><input type="checkbox" id="role_reviewer" ${user?.roles?.includes('reviewer') ? 'checked' : ''}> ${L.reviewer || 'Reviewer'}</label>
           <label><input type="checkbox" id="role_reviewee" ${(user?.roles?.includes('reviewee') || !user || !user.roles || user.roles.length === 0) ? 'checked' : ''}> ${L.reviewee || 'Reviewee'}</label>
        </div>
      </div>

      <input type="hidden" id="userId" value="${user?.id || ''}" />
      
      <div class="btn-group">
        <button class="btn-primary" onclick="save()">${L.save || 'Save'}</button>
        <button class="btn-secondary" onclick="cancel()">${L.cancel}</button>
      </div>
    </div>
    
    <script>
      function save() {
        const roles = [];
        if (document.getElementById('role_reviewer').checked) roles.push('reviewer');
        if (document.getElementById('role_reviewee').checked) roles.push('reviewee');
        
        vscode.postMessage({
          command: 'saveUser',
          data: {
            id: document.getElementById('userId').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            roles: roles
          }
        });
      }
      function cancel() {
        vscode.postMessage({ command: 'cancel' });
      }
    </script>
  `);
}

function getHtml(L: any, content: string): string {
  return /*html*/ `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 24px; line-height: 1.5; }
    h1 { font-size: 1.5em; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    
    table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); border-radius: 4px; overflow: hidden; }
    th { text-align: left; padding: 12px; background: var(--vscode-list-hoverBackground); font-size: 0.9em; opacity: 0.8; }
    td { padding: 12px; border-top: 1px solid var(--vscode-widget-border); }
    .user-name { font-weight: 600; }
    .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 6px; font-weight: 500; }
    .badge-reviewer { background: #007acc; color: white; }
    .badge-reviewee { background: #388e3c; color: white; }
    
    .actions-cell { display: flex; gap: 4px; }
    button { 
      padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;
      background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    }
    button:hover { opacity: 0.8; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.danger:hover { background: #d73a49; color: white; }
    
    .form-container { max-width: 400px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); padding: 20px; border-radius: 8px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; opacity: 0.9; }
    .form-group input[type="text"], .form-group input[type="password"] { 
      width: 100%; padding: 8px; box-sizing: border-box; background: var(--vscode-input-background); 
      color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;
    }
    .checkbox-group { display: flex; gap: 16px; margin-top: 10px; }
    .checkbox-group label { display: flex; align-items: center; gap: 6px; font-weight: normal; font-size: 13px; }
    .btn-group { display: flex; gap: 10px; margin-top: 10px; }
    .empty-msg { text-align: center; padding: 60px; opacity: 0.5; font-style: italic; }
  </style>
</head>
<body>
  ${content}
  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- API Helpers ---
import * as http from 'http';
import * as https from 'https';

async function apiRequest<T>(method: string, url: string, token: string, body?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try { reject(new Error(JSON.parse(data).error)); } catch { reject(new Error(`HTTP ${res.statusCode}`)); }
        } else {
          try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null as any); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fetchUsers(url: string, token: string) { return apiRequest<UserInfo[]>('GET', `${url}/api/users`, token); }
async function createUser(url: string, token: string, u: string, p: string, r: string[]) { return apiRequest('POST', `${url}/api/users`, token, { username: u, password: p, roles: r }); }
async function deleteUser(url: string, token: string, id: string) { return apiRequest('DELETE', `${url}/api/users/${id}`, token); }
async function modifyUser(url: string, token: string, id: string, p?: string, r?: string[]) { return apiRequest('PUT', `${url}/api/users/${id}`, token, { password: p, roles: r }); }
