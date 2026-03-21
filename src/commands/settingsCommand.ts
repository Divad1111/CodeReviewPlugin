/**
 * Command: Open Settings
 */
import * as vscode from 'vscode';
import { createSettingsPanel } from '../ui/settingsPanel';

export function settingsCommand(
  extensionUri: vscode.Uri,
  storagePath: string
): void {
  createSettingsPanel(extensionUri, storagePath);
}
