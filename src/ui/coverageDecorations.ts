/**
 * Editor decorations for overwritten lines and review comments.
 * - Overwritten lines: highlighted background + gutter icon
 * - Comment lines: gutter icon
 */

import * as vscode from 'vscode';
import { OverwrittenLine, ReviewComment } from '../svn/types';

// Decoration type for overwritten lines (lines where another author overwrote the target)
const overwrittenDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
  gutterIconPath: new vscode.ThemeIcon('warning').id, // fallback
  gutterIconSize: 'contain',
  overviewRulerColor: 'rgba(255, 165, 0, 0.7)',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  isWholeLine: true,
  after: {
    contentText: ' ⚠ overwritten',
    color: new vscode.ThemeColor('editorWarning.foreground'),
    fontStyle: 'italic',
  },
});

// Decoration type for comment markers
const commentDecorationType = vscode.window.createTextEditorDecorationType({
  gutterIconSize: 'contain',
  overviewRulerColor: 'rgba(100, 149, 237, 0.7)',
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  after: {
    contentText: ' 💬',
    color: new vscode.ThemeColor('editorInfo.foreground'),
  },
});

/**
 * Apply overwritten-line decorations to the given editor.
 */
export function applyOverwrittenDecorations(
  editor: vscode.TextEditor,
  overwrittenLines: OverwrittenLine[]
): void {
  const decorations: vscode.DecorationOptions[] = overwrittenLines.map((ol) => {
    const line = ol.lineNumber - 1; // VS Code lines are 0-indexed
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    return {
      range,
      hoverMessage: new vscode.MarkdownString(
        `**⚠ Overwritten Line**\n\n` +
        `Originally modified by **${ol.originalAuthor}** in r${ol.originalRevision}\n\n` +
        `Currently written by **${ol.currentAuthor}** in r${ol.currentRevision}\n\n` +
        `---\n` +
        `**Original content:**\n\`\`\`\n${ol.originalContent}\n\`\`\`\n\n` +
        `**Current content:**\n\`\`\`\n${ol.currentContent}\n\`\`\``
      ),
    };
  });

  editor.setDecorations(overwrittenDecorationType, decorations);
}

/**
 * Apply comment decorations to the given editor.
 */
export function applyCommentDecorations(
  editor: vscode.TextEditor,
  comments: ReviewComment[]
): void {
  const decorations: vscode.DecorationOptions[] = comments.map((c) => {
    const line = c.lineNumber - 1; // VS Code lines are 0-indexed
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    return {
      range,
      hoverMessage: new vscode.MarkdownString(
        `**💬 Review Comment** (${new Date(c.createdAt).toLocaleString()})\n\n` +
        `${c.commentText}\n\n` +
        (c.codeSnippet ? `**Code:**\n\`\`\`\n${c.codeSnippet}\n\`\`\`` : '')
      ),
    };
  });

  editor.setDecorations(commentDecorationType, decorations);
}

/**
 * Clear all audit decorations from the given editor.
 */
export function clearDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(overwrittenDecorationType, []);
  editor.setDecorations(commentDecorationType, []);
}

export { overwrittenDecorationType, commentDecorationType };
