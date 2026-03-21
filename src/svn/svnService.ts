/**
 * SVN command-line wrapper service.
 * All operations are async and use child_process.spawn to avoid blocking the UI.
 */

import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { SvnLogEntry, BlameLine, DiffFile } from './types';
import { parseLogXml, parseBlameXml, parseDiffUnified } from './svnParser';
import { getSettings } from '../storage/settingsRepo';

// Global output channel for debugging
const svnLogChannel = vscode.window.createOutputChannel('SVN Audit Log');

const execFileAsync = util.promisify(cp.execFile);

/**
 * Execute a shell command and return stdout as a string.
 */
async function execSvn(args: string[], cwd?: string): Promise<string> {
  const settings = getSettings();
  const authArgs = [];
  if (settings.svnUsername) {
    authArgs.push('--username', settings.svnUsername);
  }
  if (settings.svnPassword) {
    authArgs.push('--password', settings.svnPassword);
  }

  const fullArgs = ['--non-interactive', '--trust-server-cert', ...authArgs, ...args];

  svnLogChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] Executing: svn ${fullArgs.join(' ')}`);

  try {
    // maxBuffer: 100MB (SVN diffs for large files can be massive)
    const { stdout, stderr } = await execFileAsync('svn', fullArgs, {
      cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 100,
      timeout: 120000, // 120s timeout
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      encoding: 'utf8'
    });

    svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Completed successfully. (Output length: ${stdout.length} bytes)`);
    return stdout;
  } catch (err: any) {
    svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Failed: ${err.message}`);
    if (err.stderr) {
      svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Stderr: ${err.stderr}`);
    }
    throw new Error(`svn command failed: ${err.stderr || err.message}`);
  }
}

export class SvnService {
  /**
   * Check if SVN CLI is available in PATH.
   * Shows an error message if not found.
   */
  async checkSvn(): Promise<boolean> {
    try {
      await execSvn(['--version', '--quiet']);
      return true;
    } catch {
      vscode.window.showErrorMessage(
        'SVN command-line tool not found. Please install SVN and ensure it is in your PATH.',
        'Download SVN'
      ).then((choice) => {
        if (choice === 'Download SVN') {
          vscode.env.openExternal(vscode.Uri.parse('https://subversion.apache.org/packages.html'));
        }
      });
      return false;
    }
  }

  /**
   * Fetch SVN log entries for a given URL and date range.
   * Passing username/password here relies on SVN caching it automatically for the system.
   */
  async getLog(repoUrl: string, startDate: string, endDate: string): Promise<SvnLogEntry[]> {
    // To make endDate inclusive without using spaces (which breaks PowerShell and SVN argv parsers on Windows),
    // we advance the endDate by one full day. e.g. "2026-03-20" -> "2026-03-21"
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const endInclusiveStr = end.toISOString().split('T')[0];

    const args = [
      'log',
      '--xml',
      '-v', // verbose — include changed paths
      '-r', `{${startDate}}:{${endInclusiveStr}}`,
    ];

    args.push(repoUrl);

    const xml = await execSvn(args);
    return parseLogXml(xml);
  }

  /**
   * Fetch SVN logs for a specific author in a date range.
   */
  async getLogsForAuthor(repoUrl: string, startDate: string, endDate: string, author: string): Promise<SvnLogEntry[]> {
    const logs = await this.getLog(repoUrl, startDate, endDate);
    return logs.filter(l => l.author === author);
  }

  /**
   * Get unified diff for a specific file between two revisions.
   */
  async getDiffForFile(repoUrl: string, filePath: string, revBase: number, revEnd: number): Promise<string> {
    const root = await this.getRepoRoot(repoUrl);
    const fullUrl = filePath.startsWith('/')
      ? `${root}${filePath}`
      : `${root}/${filePath}`;

    const args = [
      'diff',
      '-r', `${revBase}:${revEnd}`,
      fullUrl,
    ];
    return execSvn(args);
  }

  /**
   * Get unified diff for an entire URL between two revisions.
   */
  async getDiff(repoUrl: string, revBase: number, revEnd: number): Promise<string> {
    const args = [
      'diff',
      '-r', `${revBase}:${revEnd}`,
      repoUrl,
    ];
    return execSvn(args);
  }

  /**
   * Get parsed diff files between two revisions.
   */
  async getDiffParsed(repoUrl: string, revBase: number, revEnd: number): Promise<DiffFile[]> {
    const raw = await this.getDiff(repoUrl, revBase, revEnd);
    return parseDiffUnified(raw);
  }

  private repoRootCache = new Map<string, string>();

  /**
   * Get the repository root for a given URL.
   */
  async getRepoRoot(repoUrl: string): Promise<string> {
    if (this.repoRootCache.has(repoUrl)) {
      return this.repoRootCache.get(repoUrl)!;
    }

    try {
      const xml = await execSvn(['info', '--xml', repoUrl]);
      // Simple string parsing to avoid full XML parser overhead here, 
      // but let's use a regex to be safe with the structure.
      const match = xml.match(/<root>(.*)<\/root>/);
      if (match && match[1]) {
        const root = match[1];
        this.repoRootCache.set(repoUrl, root);
        return root;
      }
    } catch (err) {
      console.error('Failed to get repo root:', err);
    }

    // Fallback to the original URL if we can't get the root
    return repoUrl;
  }

  /**
   * Fetch file content at a specific revision using `svn cat`.
   */
  async getCat(repoUrl: string, filePath: string, revision: number): Promise<string> {
    const root = await this.getRepoRoot(repoUrl);
    const fullPath = filePath.startsWith('/')
      ? `${root}${filePath}`
      : `${root}/${filePath}`;

    const args = [
      'cat',
      '-r', String(revision),
      fullPath,
    ];
    return execSvn(args);
  }

  /**
   * Get blame (annotate) information for a file at HEAD.
   */
  async getBlame(repoUrl: string, filePath: string): Promise<BlameLine[]> {
    const root = await this.getRepoRoot(repoUrl);
    const fullPath = filePath.startsWith('/')
      ? `${root}${filePath}`
      : `${root}/${filePath}`;

    const args = [
      'blame',
      '--xml',
      fullPath,
    ];
    const xml = await execSvn(args);
    return parseBlameXml(xml);
  }

  /**
   * Get blame information for a file at a specific revision.
   */
  async getBlameAtRevision(repoUrl: string, filePath: string, revision: number): Promise<BlameLine[]> {
    const root = await this.getRepoRoot(repoUrl);
    const fullPath = filePath.startsWith('/')
      ? `${root}${filePath}`
      : `${root}/${filePath}`;

    const args = [
      'blame',
      '--xml',
      '-r', `1:${revision}`,
      fullPath,
    ];
    const xml = await execSvn(args);
    return parseBlameXml(xml);
  }
}
