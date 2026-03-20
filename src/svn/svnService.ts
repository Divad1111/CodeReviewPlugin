/**
 * SVN command-line wrapper service.
 * All operations are async and use child_process.spawn to avoid blocking the UI.
 */

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { SvnLogEntry, BlameLine, DiffFile } from './types';
import { parseLogXml, parseBlameXml, parseDiffUnified } from './svnParser';

/**
 * Execute a shell command and return stdout as a string.
 * Uses spawn for streaming to handle large outputs.
 */
function execSvn(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = cp.spawn('svn', args, {
      cwd,
      shell: true,
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      if (code !== 0) {
        reject(new Error(`svn exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn svn: ${err.message}. Is SVN installed and in your PATH?`));
    });
  });
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
   */
  async getLog(repoUrl: string, startDate: string, endDate: string): Promise<SvnLogEntry[]> {
    const args = [
      'log',
      '--xml',
      '-v', // verbose — include changed paths
      '-r', `{${startDate}}:{${endDate}}`,
      repoUrl,
    ];
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
