/**
 * Virtual document content provider for SVN file contents.
 * Scheme: svn-audit
 * URI format: svn-audit://repo/path/to/file?rev=123&repoUrl=svn://...
 */

import * as vscode from 'vscode';
import { SvnService } from '../svn/svnService';

export class SvnContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private cache = new Map<string, string>();

  constructor(private svnService: SvnService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const cacheKey = uri.toString();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const params = new URLSearchParams(uri.query);
    const rev = parseInt(params.get('rev') || '0', 10);
    const repoUrl = params.get('repoUrl') || '';
    const filePath = uri.path;

    try {
      const content = await this.svnService.getCat(repoUrl, filePath, rev);
      this.cache.set(cacheKey, content);
      return content;
    } catch (err: any) {
      // For newly added files, files missing in older revisions, or due to Chinese SVN locales
      // suppressing the exact English "not found" text, we simply return an empty string
      // so the diff viewer treats it as a completely new file.
      this.cache.set(cacheKey, '');
      return '';
    }
  }

  /**
   * Clear the content cache (e.g. on refresh).
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Build a URI for the svn-audit scheme.
   */
  static buildUri(filePath: string, revision: number, repoUrl: string): vscode.Uri {
    return vscode.Uri.parse(
      `svn-audit://${filePath}?rev=${revision}&repoUrl=${encodeURIComponent(repoUrl)}`
    );
  }
}
