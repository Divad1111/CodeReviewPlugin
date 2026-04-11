/**
 * Command: Export Author Report
 * Generates and opens a Markdown report for a specific author.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateMarkdownReport } from '../export/markdownExporter';
import { AuditTreeItem } from '../ui/auditTreeProvider';

export async function exportAuthorReportCommand(item: AuditTreeItem): Promise<void> {
  const { sessionId, author } = item;
  if (!sessionId || !author) {return;}

  // Generate report
  const markdown = await generateMarkdownReport(sessionId, author);

  // Ask where to save
  const fileName = `audit_report_${author}_${new Date().toISOString().split('T')[0]}.md`.replace(/[\\/:*?"<>|]/g, '_');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  
  const saveUri = await vscode.window.showSaveDialog({
    title: `Export Audit Report for ${author}`,
    defaultUri: workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, fileName) : vscode.Uri.file(fileName),
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

  vscode.window.showInformationMessage(`Audit report for author "${author}" exported.`);
}
