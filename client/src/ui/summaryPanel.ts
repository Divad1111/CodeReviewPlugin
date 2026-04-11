/**
 * Webview panel for editing the final review summary for an author.
 */

import * as vscode from 'vscode';
import { ReviewSummary } from '../storage/summaryRepo';

export function createSummaryPanel(
  extensionUri: vscode.Uri,
  author: string,
  initialSummary: string,
  onSave: (summary: string) => void
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'svnAuditSummaryEditor',
    `Review Summary: ${author}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
    }
  );

  panel.webview.html = getWebviewContent(extensionUri, author, initialSummary);

  panel.webview.onDidReceiveMessage((message) => {
    if (message.command === 'save') {
      onSave(message.summary);
      panel.dispose();
    } else if (message.command === 'cancel') {
      panel.dispose();
    }
  });

  return panel;
}

function getWebviewContent(extensionUri: vscode.Uri, author: string, summary: string): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Summary</title>
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
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      height: 100vh;
      margin: 0;
    }
    h1 {
      font-size: 1.2rem;
      margin-bottom: 8px;
    }
    .description {
      opacity: 0.8;
      margin-bottom: 16px;
    }
    textarea {
      flex: 1;
      width: 100%;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 14px;
      resize: none;
      outline: none;
    }
    textarea:focus {
      border-color: var(--focus-border);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
      padding-bottom: 20px;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
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
  </style>
</head>
<body>
  <h1>最终评审总结: ${author}</h1>
  <div class="description">在此输入对该作者本次提交代码的整体评审结论与改进建议。</div>
  <textarea id="summaryText" placeholder="请输入评审总结...">${escapeHtml(summary)}</textarea>
  <div class="actions">
    <button class="btn-secondary" id="cancelBtn">取消</button>
    <button class="btn-primary" id="saveBtn">保存总结</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const text = document.getElementById('summaryText');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    text.focus();

    saveBtn.addEventListener('click', () => {
      vscode.postMessage({
        command: 'save',
        summary: text.value
      });
    });

    cancelBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    // Handle Ctrl+Enter to save
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        saveBtn.click();
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
