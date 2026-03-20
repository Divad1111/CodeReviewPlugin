/**
 * SVN command-line wrapper service.
 * All operations are async and use child_process.spawn to avoid blocking the UI.
 */

import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { SvnLogEntry, BlameLine, DiffFile } from './types';
import { parseLogXml, parseBlameXml, parseDiffUnified } from './svnParser';

// Global output channel for debugging
const svnLogChannel = vscode.window.createOutputChannel('SVN Audit Log');

const execFileAsync = util.promisify(cp.execFile);

/**
 * Execute a shell command and return stdout as a string.
 */
async function execSvn(args: string[], cwd?: string): Promise<string> {
  const fullArgs = ['--non-interactive', '--trust-server-cert', ...args];
  
  svnLogChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] Executing: svn ${fullArgs.join(' ')}`);

  try {
    // maxBuffer: 50MB (SVN logs and diffs can be large)
    const { stdout, stderr } = await execFileAsync('svn', fullArgs, {
      cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 50, 
      timeout: 60000, // 60s timeout
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
  async getLog(repoUrl: string, startDate: string, endDate: string, username?: string, password?: string): Promise<SvnLogEntry[]> {
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
    
    if (username) {
      args.push('--username', username);
    }
    if (password) {
      args.push('--password', password);
    }
    
    args.push(repoUrl);
    
    const xml = await execSvn(args);
    return parseLogXml(xml);
  }

  /**
   * Get unified diff between two revisions.
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

  /**
   * Fetch file content at a specific revision using `svn cat`.
   */
  async getCat(repoUrl: string, filePath: string, revision: number): Promise<string> {
    const fullPath = filePath.startsWith('/')
      ? `${repoUrl}${filePath}`
      : `${repoUrl}/${filePath}`;
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
    const fullPath = filePath.startsWith('/')
      ? `${repoUrl}${filePath}`
      : `${repoUrl}/${filePath}`;
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
    const fullPath = filePath.startsWith('/')
      ? `${repoUrl}${filePath}`
      : `${repoUrl}/${filePath}`;
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
