/**
 * Webview panel for creating a new audit session.
 * Shows a single form with all fields (repo URL, authors, date range)
 * and provides autocomplete from historical input records.
 */

import * as vscode from 'vscode';
import { StorageContext } from '../storage/storageContext';

/**
 * Create and show the New Session webview panel.
 * Returns a disposable panel; communicates back via onDidReceiveMessage.
 */
export function createNewSessionPanel(
  extensionUri: vscode.Uri,
  onSubmit: (data:
    | { name: string; repoUrl: string; authors: string; startDate: string; endDate: string; logKeywords?: string }
    | { command: 'deleteHistory'; type: string; value: string }
  ) => void
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'svnAuditNewSession',
    'SVN Audit: New Session',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
    }
  );

  // Default dates (shown before history loads)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Show panel immediately with empty history, then update when history loads
  panel.webview.html = getWebviewContent([], [], weekAgo, today);

  // Fetch history for autocomplete (async)
  (async () => {
    try {
      const provider = StorageContext.getProvider();
      const repoHistory = await provider.getHistory('repo_url');
      const authorHistory = await provider.getHistory('author');
      // Update webview with history data
      panel.webview.html = getWebviewContent(repoHistory, authorHistory, weekAgo, today);
    } catch { /* ignore if not available */ }
  })();

  panel.webview.onDidReceiveMessage((message) => {
    if (message.command === 'submit') {
      onSubmit(message.data);
      panel.dispose();
    } else if (message.command === 'cancel') {
      panel.dispose();
    } else if (message.command === 'deleteHistory') {
      // Pass the delete command to the extension, but don't close the panel
      onSubmit(message as any); 
    }
  });

  return panel;
}

function getWebviewContent(
  repoHistory: string[],
  authorHistory: string[],
  defaultStart: string,
  defaultEnd: string
): string {
  // Use suggestion chips for both, rather than datalist, to support deletion

  return /*html*/ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Audit Session</title>
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
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      display: flex;
      justify-content: center;
      padding: 32px 16px;
    }

    .container {
      width: 100%;
      max-width: 560px;
    }

    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h1::before { content: '📋'; }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 0.95em;
    }
    label .hint {
      font-weight: 400;
      opacity: 0.7;
      font-size: 0.9em;
    }

    input[type="text"],
    input[type="date"] {
      width: 100%;
      padding: 7px 10px;
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

    .date-row {
      display: flex;
      gap: 12px;
    }
    .date-row > div {
      flex: 1;
    }

    /* Author tags */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      min-height: 38px;
      cursor: text;
      transition: border-color 0.15s;
    }
    .tags-container:focus-within {
      border-color: var(--focus-border);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      white-space: nowrap;
    }
    .tag .remove {
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.1s;
    }
    .tag .remove:hover { opacity: 1; }
    .tag-input {
      border: none;
      outline: none;
      background: transparent;
      color: var(--input-fg);
      font-size: 13px;
      flex: 1;
      min-width: 80px;
    }

    /* History suggestions */
    .suggestions {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .suggestion-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      padding: 3px 8px;
      background: var(--btn-secondary-bg);
      color: var(--btn-secondary-fg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .suggestion-chip:hover { background: var(--btn-hover); color: var(--btn-fg); }
    .suggestion-chip .chip-delete {
      font-size: 14px;
      line-height: 1;
      opacity: 0.5;
      padding-left: 2px;
    }
    .suggestion-chip .chip-delete:hover {
      opacity: 1;
      color: var(--error-fg);
    }
    .suggestion-label {
      font-size: 11px;
      opacity: 0.6;
      margin-right: 4px;
    }

    /* Validation error */
    .error-msg {
      color: var(--error-fg);
      font-size: 12px;
      margin-top: 4px;
      display: none;
    }
    .error-msg.visible { display: block; }

    /* Buttons */
    .btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 28px;
    }

    button {
      padding: 8px 20px;
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
  </style>
</head>
<body>
  <div class="container">
    <h1>New Audit Session</h1>

    <div class="form-group">
      <label>Session Name</label>
      <input type="text" id="sessionName" placeholder="My Code Review" />
    </div>

    <div class="form-group">
      <label>SVN Repository URL</label>
      <input type="text" id="repoUrl" placeholder="svn://server/repo/trunk" />
      <div class="error-msg" id="repoUrlError">Repository URL is required</div>
      ${repoHistory.length > 0 ? `
      <div class="suggestions" id="repoSuggestions">
        <span class="suggestion-label">History:</span>
        ${repoHistory.map(u => `<span class="suggestion-chip" data-repo="${escapeHtml(u)}">
          <span class="chip-text">${escapeHtml(u)}</span>
          <span class="chip-delete" title="Delete from history" data-del-repo="${escapeHtml(u)}">×</span>
        </span>`).join('')}
      </div>` : ''}
    </div>



    <div class="form-group">
      <label>Audit Authors <span class="hint">(press Enter or comma to add)</span></label>
      <div class="tags-container" id="tagsContainer">
        <input type="text" class="tag-input" id="authorInput" placeholder="Enter author name..." />
      </div>
      <div class="error-msg" id="authorsError">At least one author is required</div>
      ${authorHistory.length > 0 ? `
      <div class="suggestions" id="authorSuggestions">
        <span class="suggestion-label">History:</span>
        ${authorHistory.map(a => `<span class="suggestion-chip" data-author="${escapeHtml(a)}">
          <span class="chip-text">${escapeHtml(a)}</span>
          <span class="chip-delete" title="Delete from history" data-del-author="${escapeHtml(a)}">×</span>
        </span>`).join('')}
      </div>` : ''}
    </div>

    <div class="form-group">
      <label>Date Range</label>
      <div class="date-row">
        <div>
          <input type="date" id="startDate" value="${defaultStart}" />
        </div>
        <div>
          <input type="date" id="endDate" value="${defaultEnd}" />
        </div>
      </div>
      <div class="error-msg" id="dateError">Start date must be before end date</div>
    </div>

    <div class="form-group">
      <label>Log Content Keywords <span class="hint">(optional, comma-separated, OR matching)</span></label>
      <input type="text" id="logKeywords" placeholder="e.g. SG-123,BUGFIX" />
    </div>

    <div class="btn-row">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="submitBtn">Create Session</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // --- Author tags logic ---
    const tags = [];
    const tagsContainer = document.getElementById('tagsContainer');
    const authorInput = document.getElementById('authorInput');

    function addTag(name) {
      name = name.trim();
      if (!name || tags.includes(name)) return;
      tags.push(name);
      renderTags();
      // Remove from suggestion chips if present
      const chip = document.querySelector('.suggestion-chip[data-author="' + name + '"]');
      if (chip) chip.style.display = 'none';
    }

    function removeTag(name) {
      const idx = tags.indexOf(name);
      if (idx > -1) tags.splice(idx, 1);
      renderTags();
      // Show suggestion chip again
      const chip = document.querySelector('.suggestion-chip[data-author="' + name + '"]');
      if (chip) chip.style.display = '';
    }

    function renderTags() {
      // Remove existing tag elements (keep input)
      tagsContainer.querySelectorAll('.tag').forEach(el => el.remove());
      tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = t + ' <span class="remove" data-tag="' + t + '">×</span>';
        tagsContainer.insertBefore(span, authorInput);
      });
    }

    tagsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        removeTag(e.target.dataset.tag);
      } else {
        authorInput.focus();
      }
    });

    authorInput.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && authorInput.value.trim()) {
        e.preventDefault();
        // Support comma-separated batch input
        authorInput.value.split(',').forEach(v => addTag(v));
        authorInput.value = '';
      }
      if (e.key === 'Backspace' && !authorInput.value && tags.length) {
        removeTag(tags[tags.length - 1]);
      }
    });

    // Suggestion chips (Repo & Authors)
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        // Handle deletion
        if (e.target.classList.contains('chip-delete')) {
          e.stopPropagation();
          const delRepo = e.target.dataset.delRepo;
          const delAuthor = e.target.dataset.delAuthor;
          
          if (delRepo) {
            vscode.postMessage({ command: 'deleteHistory', type: 'repo_url', value: delRepo });
          } else if (delAuthor) {
            vscode.postMessage({ command: 'deleteHistory', type: 'author', value: delAuthor });
          }
          chip.remove(); // Remove from UI temporarily
          return;
        }

        // Handle addition
        if (chip.dataset.author) {
          addTag(chip.dataset.author);
          authorInput.focus();
        } else if (chip.dataset.repo) {
          document.getElementById('repoUrl').value = chip.dataset.repo;
          document.getElementById('repoUrl').focus();
        }
      });
    });

    // --- Submit ---
    document.getElementById('submitBtn').addEventListener('click', () => {
      // Pick up any leftover text in the input
      if (authorInput.value.trim()) {
        authorInput.value.split(',').forEach(v => addTag(v));
        authorInput.value = '';
      }

      const sessionName = document.getElementById('sessionName').value.trim();
      const repoUrl = document.getElementById('repoUrl').value.trim();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const logKeywords = document.getElementById('logKeywords').value.trim();

      // Validate
      let valid = true;
      document.getElementById('repoUrlError').classList.toggle('visible', !repoUrl);
      if (!repoUrl) valid = false;

      document.getElementById('authorsError').classList.toggle('visible', tags.length === 0);
      if (tags.length === 0) valid = false;

      document.getElementById('dateError').classList.toggle('visible', startDate > endDate);
      if (startDate > endDate) valid = false;

      if (!valid) return;

      vscode.postMessage({
        command: 'submit',
        data: { name: sessionName, repoUrl, authors: tags.join(', '), startDate, endDate, logKeywords }
      });
    });

    // --- Cancel ---
    document.getElementById('cancelBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    // Focus the first field
    document.getElementById('repoUrl').focus();
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
