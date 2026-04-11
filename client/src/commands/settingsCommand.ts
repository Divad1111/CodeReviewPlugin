/**
 * Open settings panel command.
 */
import * as vscode from 'vscode';
import { createSettingsPanel } from '../ui/settingsPanel';

/**
 * Determine if the current user is a reviewee (server mode).
 */
function isRevieweeMode(): boolean {
  try {
    // Check context key — we can't access it directly, so use a simple heuristic:
    // The authManager is not directly accessible here, but extension.ts sets context keys.
    // We'll pass the reviewee mode as needed from the extension entry.
    return false; // Default: not reviewee. Extension will override.
  } catch {
    return false;
  }
}

export function settingsCommand(
  extensionUri: vscode.Uri,
  storagePath: string,
  revieweeMode: boolean = false
): void {
  createSettingsPanel(extensionUri, storagePath, undefined, revieweeMode);
}
