import * as vscode from 'vscode';
import { getSettings, updateSettings, AppSettings } from '../storage/settingsRepo';

export function createSettingsPanel(
  extensionUri: vscode.Uri,
  storagePath: string
): void {
  const panel = vscode.window.createWebviewPanel(
    'svnAuditSettings',
    'SVN Audit Settings',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri],
      retainContextWhenHidden: true,
    }
  );

  const settings = getSettings();
  panel.webview.html = getHtmlForWebview(panel.webview, settings);

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'save':
        updateSettings(message.settings, storagePath);
        vscode.window.showInformationMessage('Settings saved successfully.');
        break;
    }
  });
}

function getHtmlForWebview(webview: vscode.Webview, settings: AppSettings): string {
  const models = ['DeepSeek', 'OpenAI', 'Qianwen', 'Claude', 'Gemini', 'Kimi', 'GLM5'];
  const modelOptions = models.map(m => `<option value="${m}" ${settings.aiModel === m ? 'selected' : ''}>${m}</option>`).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SVN Audit Settings</title>
      <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 20px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; }
        input, select, textarea { 
          width: 100%; 
          padding: 8px; 
          background: var(--vscode-input-background); 
          color: var(--vscode-input-foreground); 
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
        }
        textarea { height: 200px; font-family: monospace; }
        .button-group { margin-top: 30px; }
        button { 
          padding: 10px 20px; 
          background: var(--vscode-button-background); 
          color: var(--vscode-button-foreground); 
          border: none; 
          cursor: pointer; 
          border-radius: 4px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        h1 { border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
        .section-title { font-size: 1.2em; border-left: 4px solid var(--vscode-button-background); padding-left: 10px; margin: 30px 0 15px 0; }
      </style>
    </head>
    <body>
      <h1>SVN Audit Settings</h1>
      
      <div class="section-title">SVN Credentials(Optional)</div>
      <div class="form-group">
        <label>Username(Optional)</label>
        <input type="text" id="svnUsername" value="${settings.svnUsername || ''}" placeholder="Enter SVN username">
      </div>
      <div class="form-group">
        <label>Password(Optional)</label>
        <input type="password" id="svnPassword" value="${settings.svnPassword || ''}" placeholder="Enter SVN password">
      </div>

      <div class="section-title">AI Engine</div>
      <div class="form-group">
        <label>AI Model</label>
        <select id="aiModel">
          ${modelOptions}
        </select>
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="aiApiKey" value="${settings.aiApiKey || ''}" placeholder="Enter API Key">
      </div>

      <div class="section-title">Coding Standards</div>
      <div class="form-group">
        <label>Definition (Guidelines for naming, comments, logic checks, etc.)</label>
        <textarea id="codingStandards" placeholder="Enter coding standards here...">${settings.codingStandards || ''}</textarea>
      </div>

      <div class="button-group">
        <button id="saveBtn">Save Settings</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('saveBtn').addEventListener('click', () => {
          const settings = {
            svnUsername: document.getElementById('svnUsername').value,
            svnPassword: document.getElementById('svnPassword').value,
            aiModel: document.getElementById('aiModel').value,
            aiApiKey: document.getElementById('aiApiKey').value,
            codingStandards: document.getElementById('codingStandards').value
          };
          vscode.postMessage({ command: 'save', settings });
        });
      </script>
    </body>
    </html>
  `;
}
