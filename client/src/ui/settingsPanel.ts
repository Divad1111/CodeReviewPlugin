import * as vscode from 'vscode';
import { AppSettings, AIModelConfig } from '../storage/settingsRepo';
import { StorageContext } from '../storage/storageContext';
import { getLocalization } from './localization';

let currentDraft: AppSettings | null = null;
let isDirty = false;

/**
 * Create the settings panel.
 * @param revieweeMode If true, only show SVN credentials, language, and action buttons.
 */
export function createSettingsPanel(
  extensionUri: vscode.Uri,
  storagePath: string,
  initialDraft?: AppSettings,
  revieweeMode: boolean = false
): void {
  const settingsPromise = initialDraft
    ? Promise.resolve(initialDraft)
    : StorageContext.getProvider().getSettings();

  settingsPromise.then(async (settings) => {
    const L = getLocalization(settings.language);
    currentDraft = { ...settings };
    isDirty = !!initialDraft;

    const panel = vscode.window.createWebviewPanel(
      'svnAuditSettings',
      L.settingsTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      }
    );

    const refresh = async () => {
      const provider = StorageContext.getProvider();
      const s = currentDraft || await provider.getSettings();
      const m = revieweeMode ? [] : await provider.getAIModels();
      const loc = getLocalization(s.language);
      panel.title = loc.settingsTitle;
      panel.webview.html = getHtmlForWebview(panel.webview, s, m, loc, revieweeMode);
    };

    await refresh();

    panel.onDidDispose(async () => {
      if (isDirty && currentDraft) {
        const s = currentDraft;
        const loc = getLocalization(s.language);
        const choice = await vscode.window.showWarningMessage(
          loc.unsavedChanges,
          { modal: true },
          loc.save,
          loc.discard
        );

        if (choice === loc.save) {
          await StorageContext.getProvider().updateSettings(currentDraft);
          vscode.window.showInformationMessage(loc.successSaved);
          isDirty = false;
          currentDraft = null;
        } else if (choice === undefined) {
          createSettingsPanel(extensionUri, storagePath, currentDraft, revieweeMode);
        } else {
          isDirty = false;
          currentDraft = null;
        }
      } else {
        currentDraft = null;
      }
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      const provider = StorageContext.getProvider();
      const currentSettings = await provider.getSettings();
      const loc = getLocalization(currentSettings.language);

      switch (message.command) {
        case 'save':
          await provider.updateSettings(message.settings);
          vscode.window.showInformationMessage(loc.successSaved);

          const newLang = message.settings.language || (vscode.env.language.startsWith('zh') ? 'zh' : 'en');
          vscode.commands.executeCommand('setContext', 'svnAudit.isZh', newLang === 'zh');

          isDirty = false;
          currentDraft = null;
          panel.dispose();
          break;
        case 'dirty':
          currentDraft = message.settings;
          isDirty = true;
          break;
        case 'addModel':
        case 'updateModel':
          await provider.upsertAIModel(message.model, message.id);
          vscode.window.showInformationMessage(message.command === 'addModel' ? loc.modelAdded : loc.modelUpdated);
          refresh();
          break;
        case 'deleteModel':
          await provider.deleteAIModel(message.id);
          vscode.window.showInformationMessage(loc.modelDeleted);
          refresh();
          break;
        case 'alert':
          vscode.window.showErrorMessage(message.text);
          break;
        case 'confirmDelete': {
          const ok = await vscode.window.showWarningMessage(loc.deleteConfirm, { modal: true }, 'OK');
          if (ok === 'OK') {
            await provider.deleteAIModel(message.id);
            vscode.window.showInformationMessage(loc.modelDeleted);
            refresh();
          }
          break;
        }
        case 'exportSettings': {
          const settings = await provider.getSettings();
          const models = await provider.getAIModels();
          const exportData = { settings, models, version: '0.1.0', timestamp: new Date().toISOString() };

          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('svn-audit-settings.json'),
            filters: { 'JSON': ['json'] },
            title: loc.exportSettings
          });

          if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(exportData, null, 2), 'utf8'));
            vscode.window.showInformationMessage(loc.successSaved);
          }
          break;
        }
        case 'importSettings': {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'JSON': ['json'] },
            title: loc.importSettings
          });

          if (uris && uris.length > 0) {
            try {
              const content = await vscode.workspace.fs.readFile(uris[0]);
              const data = JSON.parse(Buffer.from(content).toString('utf8'));
              await provider.importAllSettings(data);
              vscode.window.showInformationMessage(loc.importSuccess);
              refresh();

              const newLang = data.settings?.language || (vscode.env.language.startsWith('zh') ? 'zh' : 'en');
              vscode.commands.executeCommand('setContext', 'svnAudit.isZh', newLang === 'zh');
            } catch (err) {
              vscode.window.showErrorMessage(loc.importError);
            }
          }
          break;
        }
      }
    });
  });
}

function getHtmlForWebview(webview: vscode.Webview, settings: AppSettings, models: AIModelConfig[], L: any, revieweeMode: boolean): string {
  const modelOptions = models.map(m => `<option value="${m.name}" ${settings.aiModel === m.name ? 'selected' : ''}>${m.name}</option>`).join('');
  const modelData = JSON.stringify(models);

  // If revieweeMode, only show SVN credentials, language, and buttons
  const aiSection = revieweeMode ? '' : `
      <div class="section-title">${L.aiEngine}</div>
      <div class="form-group">
        <label>${L.currentModel}</label>
        <select id="currentModelSelect">
          ${modelOptions}
        </select>
      </div>

      <div style="background: var(--vscode-editorWidget-background); padding: 15px; border-radius: 4px; border: 1px solid var(--vscode-widget-border);">
        <div class="form-group">
          <label>${L.endpoint}</label>
          <input type="text" id="modelEndpoint" readonly>
        </div>
        <div class="form-group">
          <label>${L.modelName}</label>
          <input type="text" id="modelNameInternal" readonly>
        </div>
        <div class="button-group">
          <button id="addModelBtn" class="secondary">${L.addNewModel}</button>
          <button id="editModelBtn" class="secondary">${L.editSelected}</button>
          <button id="deleteModelBtn" class="danger">${L.deleteSelected}</button>
        </div>
      </div>`;

  const codingSection = revieweeMode ? '' : `
      <div class="section-title">${L.codingStandards}</div>
      <div class="form-group">
        <label>${L.codingStandardsDesc}</label>
        <textarea id="codingStandards" placeholder="${L.codingStandards}...">${settings.codingStandards || ''}</textarea>
      </div>

      <div class="section-title">${L.fileFiltering}</div>
      <div class="form-group">
        <label>${L.fileFilteringDesc}</label>
        <input type="text" id="excludePatterns" value="${settings.excludePatterns || ''}" placeholder="*.meta, *.prefab">
      </div>
      
      <div class="section-title">${L.otherSettings}</div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" id="debugMode" ${settings.debugMode ? 'checked' : ''} style="width: auto;">
        <label for="debugMode" style="margin-bottom: 0;">${L.debugMode}</label>
      </div>`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${L.settingsTitle}</title>
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
          box-sizing: border-box;
        }
        textarea { height: 150px; font-family: monospace; }
        .button-group { margin-top: 15px; display: flex; gap: 10px; }
        button { 
          padding: 8px 16px; 
          background: var(--vscode-button-background); 
          color: var(--vscode-button-foreground); 
          border: none; 
          cursor: pointer; 
          border-radius: 4px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        button.danger { background: #d73a49; color: white; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        
        h1 { border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
        .section-title { font-size: 1.2em; border-left: 4px solid var(--vscode-button-background); padding-left: 10px; margin: 30px 0 15px 0; }
        
        #modelModal {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center;
          z-index: 100;
        }
        .modal-content {
          background: var(--vscode-editor-background);
          padding: 24px; border-radius: 8px; width: 400px;
          border: 1px solid var(--vscode-widget-border);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        input[readonly] {
          opacity: 0.7;
          background: var(--vscode-button-secondaryBackground);
          cursor: not-allowed;
        }
      </style>
    </head>
    <body onchange="reportDirty()">
      <h1>${L.settingsTitle}</h1>
      
      <div class="section-title">${L.svnCredentials}</div>
      <div class="form-group">
        <label>${L.username}</label>
        <input type="text" id="svnUsername" value="${settings.svnUsername || ''}" placeholder="${L.username}">
      </div>
      <div class="form-group">
        <label>${L.password}</label>
        <input type="password" id="svnPassword" value="${settings.svnPassword || ''}" placeholder="${L.password}">
      </div>

      ${aiSection}
      ${codingSection}

      <div class="form-group">
        <label>${L.language}</label>
        <select id="languageSelect">
          <option value="" ${!settings.language ? 'selected' : ''}>Default (Auto-detect)</option>
          <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
          <option value="zh" ${settings.language === 'zh' ? 'selected' : ''}>简体中文</option>
        </select>
      </div>

      <div class="button-group" style="margin-top: 40px; display: flex; flex-direction: column;">
        <button id="saveAllBtn" style="font-weight: bold; font-size: 1.1em;">${L.saveAll}</button>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button id="exportSettingsBtn" class="secondary" style="flex: 1;">${L.exportSettings}</button>
          <button id="importSettingsBtn" class="secondary" style="flex: 1;">${L.importSettings}</button>
        </div>
      </div>

      ${revieweeMode ? '' : `
      <!-- Modal for Adding/Editing Models -->
      <div id="modelModal">
        <div class="modal-content">
          <h2 id="modalTitle">${L.addModelTitle}</h2>
          <div class="form-group">
            <label>${L.providerName}</label>
            <input type="text" id="modalModelName" placeholder="Name">
          </div>
          <div class="form-group">
            <label>${L.endpoint}</label>
            <input type="text" id="modalEndpoint" placeholder="https://api.openai.com/v1/chat/completions">
          </div>
          <div class="form-group">
            <label>${L.modelName}</label>
            <input type="text" id="modalModelInternal" placeholder="gpt-4o">
          </div>
          <div class="form-group">
            <label>${L.apiKey}</label>
            <input type="password" id="modalApiKey" placeholder="sk-...">
          </div>
          <div class="button-group">
            <button id="modalConfirmBtn">${L.confirm}</button>
            <button id="modalCancelBtn" class="secondary">${L.cancel}</button>
          </div>
        </div>
      </div>
      `}

      <script>
        const vscode = acquireVsCodeApi();
        const models = ${modelData};
        const isRevieweeMode = ${revieweeMode};
        let editingModelId = null;

        function getSettingsFromUI() {
          const settings = {
            svnUsername: document.getElementById('svnUsername').value,
            svnPassword: document.getElementById('svnPassword').value,
            aiModel: isRevieweeMode ? '${settings.aiModel}' : document.getElementById('currentModelSelect').value,
            codingStandards: isRevieweeMode ? '${(settings.codingStandards || '').replace(/'/g, "\\'")}' : document.getElementById('codingStandards').value,
            excludePatterns: isRevieweeMode ? '${(settings.excludePatterns || '').replace(/'/g, "\\'")}' : document.getElementById('excludePatterns').value,
            debugMode: isRevieweeMode ? ${settings.debugMode || false} : document.getElementById('debugMode').checked,
            language: document.getElementById('languageSelect').value
          };
          return settings;
        }

        function reportDirty() {
           vscode.postMessage({ command: 'dirty', settings: getSettingsFromUI() });
        }

        // Listen to all inputs for dirty tracking
        document.querySelectorAll('input, select, textarea').forEach(el => {
          el.addEventListener('input', reportDirty);
          el.addEventListener('change', reportDirty);
        });

        if (!isRevieweeMode) {
          const modelSelect = document.getElementById('currentModelSelect');
          const endpointInput = document.getElementById('modelEndpoint');
          const internalNameInput = document.getElementById('modelNameInternal');
          const editBtn = document.getElementById('editModelBtn');
          const deleteBtn = document.getElementById('deleteModelBtn');

          function updateModelFields() {
            const selectedName = modelSelect.value;
            const model = models.find(m => m.name === selectedName);
            if (model) {
              endpointInput.value = model.endpoint;
              internalNameInput.value = model.modelName;
              editBtn.disabled = false;
              deleteBtn.disabled = model.isDefault;
            }
          }

          modelSelect.addEventListener('change', () => {
            updateModelFields();
            reportDirty();
          });
          updateModelFields();

          // Modals
          const modal = document.getElementById('modelModal');
          document.getElementById('addModelBtn').addEventListener('click', () => {
            editingModelId = null;
            document.getElementById('modalTitle').innerText = '${L.addModelTitle}';
            document.getElementById('modalModelName').value = '';
            document.getElementById('modalModelName').readOnly = false;
            document.getElementById('modalEndpoint').value = '';
            document.getElementById('modalEndpoint').readOnly = false;
            document.getElementById('modalModelInternal').value = '';
            document.getElementById('modalModelInternal').readOnly = false;
            document.getElementById('modalApiKey').value = '';
            modal.style.display = 'flex';
          });

          editBtn.addEventListener('click', () => {
            const selectedName = modelSelect.value;
            const model = models.find(m => m.name === selectedName);
            if (model) {
              editingModelId = model.id;
              const isDefault = model.isDefault;
              document.getElementById('modalTitle').innerText = isDefault ? '${L.editDefaultModelTitle}' : '${L.editModelTitle}';
              document.getElementById('modalModelName').value = model.name;
              document.getElementById('modalModelName').readOnly = isDefault;
              document.getElementById('modalEndpoint').value = model.endpoint;
              document.getElementById('modalEndpoint').readOnly = isDefault;
              document.getElementById('modalModelInternal').value = model.modelName;
              document.getElementById('modalModelInternal').readOnly = false;
              document.getElementById('modalApiKey').value = model.apiKey || '';
              modal.style.display = 'flex';
            }
          });

          document.getElementById('modalCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
          });

          document.getElementById('modalConfirmBtn').addEventListener('click', () => {
            const model = {
              name: document.getElementById('modalModelName').value,
              endpoint: document.getElementById('modalEndpoint').value,
              modelName: document.getElementById('modalModelInternal').value,
              apiKey: document.getElementById('modalApiKey').value
            };
            if (!model.name || !model.endpoint || !model.modelName) {
              vscode.postMessage({ command: 'alert', text: 'All fields are required.' });
              return;
            }
            vscode.postMessage({ 
              command: editingModelId ? 'updateModel' : 'addModel', 
              model, 
              id: editingModelId 
            });
            modal.style.display = 'none';
          });

          deleteBtn.addEventListener('click', () => {
            const selectedName = modelSelect.value;
            const model = models.find(m => m.name === selectedName);
            if (model && !model.isDefault) {
               vscode.postMessage({ command: 'confirmDelete', id: model.id });
            }
          });
        }

        // Save All
        document.getElementById('saveAllBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'save', settings: getSettingsFromUI() });
        });

        // Export/Import
        document.getElementById('exportSettingsBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'exportSettings' });
        });

        document.getElementById('importSettingsBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'importSettings' });
        });
      </script>
    </body>
    </html>
  `;
}
