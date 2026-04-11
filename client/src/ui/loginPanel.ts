/**
 * Login panel — Webview for server login / standalone mode selection.
 */

import * as vscode from 'vscode';
import { getLocalization } from './localization';

export interface LoginResult {
  mode: 'login' | 'register' | 'standalone';
  serverUrl?: string;
  username?: string;
  password?: string;
}

export function createLoginPanel(
  extensionUri: vscode.Uri,
  onResult: (result: LoginResult) => void,
  savedCredentials?: { serverUrl: string; username: string; password?: string },
  language?: string
): vscode.WebviewPanel {
  const L = getLocalization(language);

  const panel = vscode.window.createWebviewPanel(
    'svnAuditLogin',
    L.loginTitle,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
    }
  );

  panel.webview.html = getLoginHtml(L, savedCredentials);

  panel.webview.onDidReceiveMessage((message) => {
    switch (message.command) {
      case 'login':
        onResult({
          mode: 'login',
          serverUrl: message.serverUrl,
          username: message.username,
          password: message.password,
        });
        break;
      case 'register':
        onResult({
          mode: 'register',
          serverUrl: message.serverUrl,
          username: message.username,
          password: message.password,
        });
        break;
      case 'standalone':
        onResult({ mode: 'standalone' });
        panel.dispose();
        break;
    }
  });

  return panel;
}

function getLoginHtml(L: any, saved?: { serverUrl: string; username: string; password?: string }): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${L.loginTitle}</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border, #444);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --btn-secondary-bg: var(--vscode-button-secondaryBackground);
      --btn-secondary-fg: var(--vscode-button-secondaryForeground);
      --focus-border: var(--vscode-focusBorder);
      --error-fg: var(--vscode-errorForeground, #f44);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 32px 16px;
    }
    .container {
      width: 100%;
      max-width: 400px;
    }
    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 24px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    h1::before { content: '🔐'; }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 0.95em;
    }
    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 8px 10px;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: var(--focus-border);
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 24px;
    }
    button {
      width: 100%;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s;
    }
    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
    }
    .btn-primary:hover { background: var(--btn-hover); }
    .btn-secondary {
      background: var(--btn-secondary-bg);
      color: var(--btn-secondary-fg);
    }
    .btn-standalone {
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--input-border);
      opacity: 0.8;
    }
    .btn-standalone:hover {
      opacity: 1;
      background: var(--input-bg);
    }
    .divider {
      text-align: center;
      margin: 16px 0;
      opacity: 0.5;
      font-size: 12px;
    }
    .error-msg {
      color: var(--error-fg);
      font-size: 12px;
      margin-top: 8px;
      display: none;
      text-align: center;
    }
    .error-msg.visible { display: block; }
    .success-msg {
      color: #4caf50;
      font-size: 12px;
      margin-top: 8px;
      display: none;
      text-align: center;
    }
    .success-msg.visible { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${L.loginTitle}</h1>
    
    <div class="form-group">
      <label>${L.serverAddress}</label>
      <input type="text" id="serverUrl" placeholder="http://localhost:3000" value="${saved?.serverUrl || 'http://localhost:3000'}">
    </div>
    
    <div class="form-group">
      <label>${L.username}</label>
      <input type="text" id="username" placeholder="${L.username}" value="${saved?.username || ''}">
    </div>
    
    <div class="form-group">
      <label>${L.password}</label>
      <input type="password" id="password" placeholder="${L.password}" value="${saved?.password || ''}">
    </div>
    
    <div class="error-msg" id="errorMsg"></div>
    <div class="success-msg" id="successMsg"></div>
    
    <div class="btn-group">
      <button class="btn-primary" id="loginBtn">${L.login}</button>
      <button class="btn-secondary" id="registerBtn">${L.register}</button>
      
      <div class="divider">── ${L.or} ──</div>
      
      <button class="btn-standalone" id="standaloneBtn">${L.standaloneMode}</button>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function getValues() {
      return {
        serverUrl: document.getElementById('serverUrl').value.trim(),
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
      };
    }
    
    function validate() {
      const { serverUrl, username, password } = getValues();
      const errorMsg = document.getElementById('errorMsg');
      
      if (!serverUrl) {
        errorMsg.textContent = '${L.serverRequired}';
        errorMsg.classList.add('visible');
        return false;
      }
      if (!username) {
        errorMsg.textContent = '${L.usernameRequired}';
        errorMsg.classList.add('visible');
        return false;
      }
      if (!password) {
        errorMsg.textContent = '${L.passwordRequired}';
        errorMsg.classList.add('visible');
        return false;
      }
      errorMsg.classList.remove('visible');
      return true;
    }
    
    document.getElementById('loginBtn').addEventListener('click', () => {
      if (!validate()) return;
      const { serverUrl, username, password } = getValues();
      vscode.postMessage({ command: 'login', serverUrl, username, password });
    });
    
    document.getElementById('registerBtn').addEventListener('click', () => {
      if (!validate()) return;
      const { serverUrl, username, password } = getValues();
      vscode.postMessage({ command: 'register', serverUrl, username, password });
    });
    
    document.getElementById('standaloneBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'standalone' });
    });

    // Enter key submits login
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('loginBtn').click();
      }
    });
    
    // Listen for error messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'error') {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = message.message;
        errorMsg.classList.add('visible');
        document.getElementById('successMsg').classList.remove('visible');
      }
    });

    // Focus first empty field
    if (!document.getElementById('serverUrl').value) {
      document.getElementById('serverUrl').focus();
    } else if (!document.getElementById('username').value) {
      document.getElementById('username').focus();
    } else {
      document.getElementById('password').focus();
    }
  </script>
</body>
</html>`;
}
