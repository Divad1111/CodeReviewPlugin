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
import { VcsProvider } from '../vcs/vcsProvider';
import { StorageContext } from '../storage/storageContext';

// Global output channel for debugging
const svnLogChannel = vscode.window.createOutputChannel('SVN Audit Log');

const execFileAsync = util.promisify(cp.execFile);

/**
 * Execute a shell command and return stdout as a string.
 */
async function execSvn(args: string[], cwd?: string, skipAuth = false): Promise<string> {
  const authArgs = [];
  if (!skipAuth) {
    let settings: any;
    try {
      if (StorageContext.hasProvider()) {
        settings = await StorageContext.getProvider().getSettings();
      } else {
        settings = getSettings();
      }
    } catch (e) {
      settings = getSettings(); // Fallback to local
    }

    if (settings && settings.svnUsername) {
      authArgs.push('--username', settings.svnUsername);
    }
    if (settings && settings.svnPassword) {
      authArgs.push('--password', settings.svnPassword);
    }
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
    const stderr = err.stderr || '';
    svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Failed: ${err.message}`);
    if (stderr) {
      svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Stderr: ${stderr}`);
    }

    let userFriendlyMsg = stderr || err.message;
    if (stderr.includes('E220001') || stderr.includes('Item is not readable')) {
      userFriendlyMsg = `svn: E220001 (Item is not readable). This usually means you don't have read permission for some paths in this revision range. Try providing SVN credentials in Settings or using a more specific Repository URL that you have full access to.`;
    } else if (stderr.includes('E170001') || stderr.includes('Authorization failed')) {
      userFriendlyMsg = `svn: E170001 (Authorization failed). Please check your SVN username and password in Settings.`;
    }

    throw new Error(`svn command failed: ${userFriendlyMsg}`);
  }
}

export class SvnService extends VcsProvider {
  /**
   * Check if SVN CLI is available in PATH.
   * Shows an error message if not found.
   */
  async checkAvailable(): Promise<boolean> {
    try {
      await execSvn(['--version', '--quiet'], undefined, true);
      return true;
    } catch (err: any) {
      svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] SVN Check Failed: ${err.message}`);
      vscode.window.showErrorMessage(
        `SVN command-line tool check failed: ${err.message}. Please ensure SVN is installed and in your PATH.`,
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
      repoUrl
    ];

    try {
      const xml = await execSvn(args);
      return parseLogXml(xml);
    } catch (err: any) {
      // If verbose log fails due to permission issues (E220001), 
      // some SVN servers are strict and block the entire log if one path in one revision is unreadable.
      // We fallback to a slower but more resilient method: fetch the list of revisions first, 
      // then try to get verbose info for each one individually, skipping those that remain unreadable.
      if (err.message.includes('E220001') || err.message.includes('Item is not readable')) {
        svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Batch verbose log failed (E220001). Attempting resilient fallback (one-by-one)...`);
        
        let basicEntries: SvnLogEntry[];
        try {
          // 1. Get basic logs without -v (this usually succeeds even with strict authz)
          const basicArgs = ['log', '--xml', '-r', `{${startDate}}:{${endInclusiveStr}}`, repoUrl];
          const basicXml = await execSvn(basicArgs);
          basicEntries = await parseLogXml(basicXml);
        } catch (fallbackErr: any) {
          svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Resilient fallback failed at basic log: ${fallbackErr.message}`);
          throw new Error(`SVN log failed even in non-verbose mode. This usually means the URL "${repoUrl}" itself is unreadable with your current permissions. Error: ${fallbackErr.message}`);
        }
        
        if (basicEntries.length === 0) {return [];}

        // 2. For each revision, attempt to get verbose info
        const resilientEntries: SvnLogEntry[] = [];
        for (const entry of basicEntries) {
          try {
            const detailXml = await execSvn(['log', '--xml', '-v', '-r', String(entry.revision), repoUrl]);
            const detailed = await parseLogXml(detailXml);
            if (detailed.length > 0) {
              resilientEntries.push(detailed[0]);
            }
          } catch (detailErr: any) {
            // If this specific revision is unreadable, we have to skip its file details
            svnLogChannel.appendLine(`[${new Date().toLocaleTimeString()}] Skipping revision ${entry.revision} due to permission error: ${detailErr.message}`);
            // We can still keep the basic entry but without changedPaths
            resilientEntries.push({
              ...entry,
              changedPaths: []
            });
          }
        }
        return resilientEntries;
      }
      throw err;
    }
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
  async getDiffForFile(repoUrl: string, filePath: string, revBase: string | number, revEnd: string | number): Promise<string> {
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
  async getDiff(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<string> {
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
  async getDiffParsed(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<DiffFile[]> {
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
  async getCat(repoUrl: string, filePath: string, revision: string | number): Promise<string> {
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
  async getBlameAtRevision(repoUrl: string, filePath: string, revision: string | number): Promise<BlameLine[]> {
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

  /**
   * Get basic SVN info for a local path or URL.
   */
  async getInfo(localPath: string): Promise<{ repositoryRoot: string; relativeUrl: string; url: string } | null> {
    try {
      const xml = await execSvn(['info', '--xml', localPath]);
      const rootMatch = xml.match(/<root>(.*)<\/root>/);
      const urlMatch = xml.match(/<url>(.*)<\/url>/);
      const relativeMatch = xml.match(/<relative-url>(.*)<\/relative-url>/);

      return {
        repositoryRoot: rootMatch ? rootMatch[1] : '',
        url: urlMatch ? urlMatch[1] : '',
        relativeUrl: relativeMatch ? relativeMatch[1] : ''
      };
    } catch (err) {
      return null;
    }
  }
}
