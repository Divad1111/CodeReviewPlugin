/**
 * Command: Jump to Source
 * Opens the local workspace file at the same position as the current diff view line.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getReviewLogById } from '../storage/reviewRepo';
import { getSessionById } from '../storage/sessionRepo';
import { SvnService } from '../svn/svnService';

export async function jumpToSourceCommand(svnService: SvnService): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'svn-audit') {
    vscode.window.showWarningMessage('This command is only available in SVN Audit diff views.');
    return;
  }

  const uri = editor.document.uri;
  const params = new URLSearchParams(uri.query);
  const reviewLogId = params.get('reviewLogId');

  if (!reviewLogId) {
    vscode.window.showWarningMessage('Could not identify the review log for this file.');
    return;
  }

  const reviewLog = getReviewLogById(reviewLogId);
  if (!reviewLog) {
    vscode.window.showWarningMessage('Review log not found in database.');
    return;
  }

  const session = getSessionById(reviewLog.sessionId);
  if (!session) {
    vscode.window.showWarningMessage('Session not found.');
    return;
  }

  const lineNumber = editor.selection.start.line + 1;
  const repoPath = reviewLog.filePath; // e.g. /trunk/src/main.ts

  // Try to find the local file
  const localFile = await findLocalFile(svnService, session.repoUrl, repoPath);

  if (localFile) {
    const doc = await vscode.workspace.openTextDocument(localFile);
    const targetEditor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false
    });

    // Move cursor to the same line
    const pos = new vscode.Position(lineNumber - 1, 0);
    targetEditor.selection = new vscode.Selection(pos, pos);
    targetEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  } else {
    // Fallback: try to find by basename in the workspace
    const filename = path.basename(repoPath);
    const files = await vscode.workspace.findFiles(`**/${filename}`, '**/node_modules/**', 10);

    if (files.length === 1) {
      const doc = await vscode.workspace.openTextDocument(files[0]);
      const targetEditor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false
      });
      const pos = new vscode.Position(lineNumber - 1, 0);
      targetEditor.selection = new vscode.Selection(pos, pos);
      targetEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } else if (files.length > 1) {
      const quickPick = await vscode.window.showQuickPick(
        files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
        { placeHolder: `Multiple files found matching ${filename}. Select the correct source file:` }
      );
      if (quickPick) {
        const doc = await vscode.workspace.openTextDocument(quickPick.uri);
        const targetEditor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: false
        });
        const pos = new vscode.Position(lineNumber - 1, 0);
        targetEditor.selection = new vscode.Selection(pos, pos);
        targetEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    } else {
      vscode.window.showErrorMessage(`Could not find local file matching: ${repoPath}`);
    }
  }
}

/**
 * Attempt to map a repository path to a local workspace file using SVN info.
 */
async function findLocalFile(svnService: SvnService, sessionRepoUrl: string, repoPath: string): Promise<vscode.Uri | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {return undefined;}

  for (const folder of folders) {
    try {
      // In a real optimized extension, we might cache this info per workspace folder
      const info = await svnService.getInfo(folder.uri.fsPath);
      if (!info) {continue;}

      // If the repository root matches
      if (info.repositoryRoot === sessionRepoUrl || sessionRepoUrl.startsWith(info.repositoryRoot)) {
        // repoPath is absolute in the repo (starts with /)
        // info.relativeUrl is something like ^/trunk
        const relativeInRepo = info.relativeUrl.replace(/^\^/, ''); // /trunk
        
        if (repoPath.startsWith(relativeInRepo)) {
          const relativeToFolder = repoPath.substring(relativeInRepo.length).replace(/^\//, '');
          const localPath = path.join(folder.uri.fsPath, relativeToFolder);
          return vscode.Uri.file(localPath);
        }
      }
    } catch (err) {
      // Not an SVN folder, skip
    }
  }

  return undefined;
}
