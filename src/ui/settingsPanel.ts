import * as vscode from 'vscode';
import { getSettings, updateSettings, AppSettings, getAIModels, upsertAIModel, deleteAIModel, AIModelConfig } from '../storage/settingsRepo';

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

  const refresh = () => {
    const settings = getSettings();
    const models = getAIModels();
    panel.webview.html = getHtmlForWebview(panel.webview, settings, models);
  };

  refresh();

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'save':
        updateSettings(message.settings, storagePath);
        vscode.window.showInformationMessage('Settings saved successfully.');
        break;
      case 'addModel':
      case 'updateModel':
        upsertAIModel(message.model, storagePath, message.id);
        vscode.window.showInformationMessage(`Model '${message.model.name}' ${message.command === 'addModel' ? 'added' : 'updated'}.`);
        refresh();
        break;
      case 'deleteModel':
        deleteAIModel(message.id, storagePath);
        vscode.window.showInformationMessage('Model deleted.');
        refresh();
        break;
    }
  });
}

function getHtmlForWebview(webview: vscode.Webview, settings: AppSettings, models: AIModelConfig[]): string {
  const modelOptions = models.map(m => `<option value="${m.name}" ${settings.aiModel === m.name ? 'selected' : ''}>${m.name}</option>`).join('');
  const modelData = JSON.stringify(models);

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
    <body>
      <h1>SVN Audit Settings</h1>
      
      <div class="section-title">SVN Credentials (Optional)</div>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="svnUsername" value="${settings.svnUsername || ''}" placeholder="Enter SVN username">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="svnPassword" value="${settings.svnPassword || ''}" placeholder="Enter SVN password">
      </div>

      <div class="section-title">AI Engine</div>
      <div class="form-group">
        <label>Select Current Model</label>
        <select id="currentModelSelect">
          ${modelOptions}
        </select>
      </div>

      <div style="background: var(--vscode-editorWidget-background); padding: 15px; border-radius: 4px; border: 1px solid var(--vscode-widget-border);">
        <div class="form-group">
          <label>Endpoint</label>
          <input type="text" id="modelEndpoint" readonly>
        </div>
        <div class="form-group">
          <label>Model Name</label>
          <input type="text" id="modelNameInternal" readonly>
        </div>
        <div class="button-group">
          <button id="addModelBtn" class="secondary">Add New Model</button>
          <button id="editModelBtn" class="secondary">Edit Selected</button>
          <button id="deleteModelBtn" class="danger">Delete Selected</button>
        </div>
      </div>

      <div class="section-title">Coding Standards</div>
      <div class="form-group">
        <label>Definition (Guidelines for naming, comments, logic checks, etc.)</label>
        <textarea id="codingStandards" placeholder="Enter coding standards here...">${settings.codingStandards || ''}</textarea>
      </div>

      <div class="button-group" style="margin-top: 40px;">
        <button id="saveAllBtn" style="width: 100%; font-weight: bold; font-size: 1.1em;">Save All Settings</button>
      </div>

      <!-- Modal for Adding/Editing Models -->
      <div id="modelModal">
        <div class="modal-content">
          <h2 id="modalTitle">Add AI Model</h2>
          <div class="form-group">
            <label>Provider Name (e.g., OpenAI)</label>
            <input type="text" id="modalModelName" placeholder="Name">
          </div>
          <div class="form-group">
            <label>Endpoint</label>
            <input type="text" id="modalEndpoint" placeholder="https://api.openai.com/v1/chat/completions">
          </div>
          <div class="form-group">
            <label>Model Name</label>
            <input type="text" id="modalModelInternal" placeholder="gpt-4o">
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input type="password" id="modalApiKey" placeholder="sk-...">
          </div>
          <div class="button-group">
            <button id="modalConfirmBtn">Confirm</button>
            <button id="modalCancelBtn" class="secondary">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const models = ${modelData};
        let editingModelId = null;

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
            
            // Protect default model (only delete is disabled)
            const isDefault = model.isDefault;
            editBtn.disabled = false;
            deleteBtn.disabled = isDefault;
          }
        }

        modelSelect.addEventListener('change', updateModelFields);
        updateModelFields();

        // Modals
        const modal = document.getElementById('modelModal');
        document.getElementById('addModelBtn').addEventListener('click', () => {
          editingModelId = null;
          document.getElementById('modalTitle').innerText = 'Add AI Model';
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
            document.getElementById('modalTitle').innerText = isDefault ? 'Edit Default Model (API Key only)' : 'Edit AI Model';
            
            const nameInput = document.getElementById('modalModelName');
            nameInput.value = model.name;
            nameInput.readOnly = isDefault;
            
            const endpointInput = document.getElementById('modalEndpoint');
            endpointInput.value = model.endpoint;
            endpointInput.readOnly = isDefault;
            
            const internalNameInput = document.getElementById('modalModelInternal');
            internalNameInput.value = model.modelName;
            internalNameInput.readOnly = false; // Model name is now editable for all models
            
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
            return alert('All fields are required.');
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
             if (confirm('Are you sure you want to delete this model?')) {
               vscode.postMessage({ command: 'deleteModel', id: model.id });
             }
          }
        });

        // Save All
        document.getElementById('saveAllBtn').addEventListener('click', () => {
          const settings = {
            svnUsername: document.getElementById('svnUsername').value,
            svnPassword: document.getElementById('svnPassword').value,
            aiModel: modelSelect.value,
            codingStandards: document.getElementById('codingStandards').value
          };
          vscode.postMessage({ command: 'save', settings });
        });
      </script>
    </body>
    </html>
  `;
}

