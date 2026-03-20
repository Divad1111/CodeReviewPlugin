/**
 * Command: Export Report
 * Shows a QuickPick to select a session, then generates and opens a Markdown report.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSessions } from '../storage/sessionRepo';
import { generateMarkdownReport } from '../export/markdownExporter';

export async function exportReportCommand(storagePath: string): Promise<void> {
  const sessions = getSessions();

  if (sessions.length === 0) {
    vscode.window.showWarningMessage('No audit sessions found. Create a new session first.');
    return;
  }

  // QuickPick to select a session
  const items = sessions.map((s) => ({
    label: `${new Date(s.createdAt).toLocaleDateString()} — ${s.authors.join(', ')}`,
    description: `${s.startDate} to ${s.endDate}`,
    detail: s.repoUrl,
    sessionId: s.id,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: 'SVN Audit: Select Session to Export',
    placeHolder: 'Choose a session...',
  });

  if (!selected) {return;}

  // Generate report
  const markdown = generateMarkdownReport(selected.sessionId);

  // Ask where to save
  const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  const saveUri = await vscode.window.showSaveDialog({
    title: 'Save Audit Report',
    defaultUri: defaultUri
      ? vscode.Uri.joinPath(defaultUri, `svn_audit_report_${new Date().toISOString().split('T')[0]}.md`)
      : undefined,
    filters: {
      'Markdown': ['md'],
      'All Files': ['*'],
    },
  });

  if (!saveUri) {return;}

  // Write file
  fs.writeFileSync(saveUri.fsPath, markdown, 'utf-8');

  // Open in editor
  const doc = await vscode.workspace.openTextDocument(saveUri);
  await vscode.window.showTextDocument(doc, { preview: false });

  vscode.window.showInformationMessage(`Audit report exported to ${path.basename(saveUri.fsPath)}`);
}
