import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { VcsProvider } from './vcsProvider';
import { SvnLogEntry, BlameLine, DiffFile } from '../svn/types';
import { parseDiffUnified } from '../svn/svnParser';

const execFileAsync = util.promisify(cp.execFile);

export class GitProvider extends VcsProvider {
  /**
   * Execute a shell command and return stdout as a string.
   */
  private async execGit(args: string[], cwd?: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 100,
        timeout: 120000,
        env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
        encoding: 'utf8'
      });
      return stdout;
    } catch (err: any) {
      throw new Error(`git command failed: ${err.stderr || err.message}`);
    }
  }

  async checkAvailable(): Promise<boolean> {
    try {
      await this.execGit(['--version']);
      return true;
    } catch (err) {
      return false;
    }
  }

  private parseGitLog(output: string): SvnLogEntry[] {
    const entries: SvnLogEntry[] = [];
    // Git log formatting using custom format:
    // ::COMMIT::%H::%an::%aI::%s::
    // Then file statuses
    const commits = output.split('::COMMIT::').filter(c => c.trim().length > 0);

    for (const commitBlock of commits) {
      const lines = commitBlock.trim().split('\n');
      if (lines.length === 0) {continue;}
      
      const headerParts = lines[0].split('::');
      if (headerParts.length < 4) {continue;}

      const hash = headerParts[0];
      const author = headerParts[1];
      const date = headerParts[2];
      const message = headerParts[3];

      const changedPaths = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {continue;}
        const [actionRaw, ...pathParts] = line.split('\t');
        const pathStr = pathParts.join('\t');
        if (actionRaw && pathStr) {
          const action = actionRaw.charAt(0).toUpperCase() as 'A' | 'M' | 'D' | 'R';
          changedPaths.push({ action, path: pathStr });
        }
      }

      // Convert pseudo revision to number by hashing or just use it if allowed.
      // Since revision is currently number | string in SvnLogEntry but types.ts has number,
      // it might conflict unless we use string. We will cast it or assign a dummy number.
      entries.push({
        revision: hash as any, 
        author,
        date,
        message,
        changedPaths
      });
    }
    return entries;
  }

  async getLog(repoUrl: string, startDate: string, endDate: string): Promise<SvnLogEntry[]> {
    // For Git, repoUrl is typically a local directory path where git is initialized
    // Make sure endDate includes the full day
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const endInclusiveStr = end.toISOString().split('T')[0];

    const args = [
      'log',
      `--since="${startDate} 00:00:00"`,
      `--until="${endInclusiveStr} 00:00:00"`,
      '--name-status',
      '--format=::COMMIT::%H::%an::%aI::%s::'
    ];

    const stdout = await this.execGit(args, repoUrl);
    return this.parseGitLog(stdout);
  }

  async getLogsForAuthor(repoUrl: string, startDate: string, endDate: string, author: string): Promise<SvnLogEntry[]> {
    // Make sure endDate includes the full day
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const endInclusiveStr = end.toISOString().split('T')[0];

    const args = [
      'log',
      `--author="${author}"`,
      `--since="${startDate} 00:00:00"`,
      `--until="${endInclusiveStr} 00:00:00"`,
      '--name-status',
      '--format=::COMMIT::%H::%an::%aI::%s::'
    ];

    const stdout = await this.execGit(args, repoUrl);
    return this.parseGitLog(stdout);
  }

  async getDiffForFile(repoUrl: string, filePath: string, revBase: string | number, revEnd: string | number): Promise<string> {
    const args = ['diff', `${revBase}..${revEnd}`, '--', filePath];
    return this.execGit(args, repoUrl);
  }

  async getDiff(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<string> {
    const args = ['diff', `${revBase}..${revEnd}`];
    return this.execGit(args, repoUrl);
  }

  async getDiffParsed(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<DiffFile[]> {
    const raw = await this.getDiff(repoUrl, revBase, revEnd);
    // Git unified diffs can typically be parsed by the same logic as SVN
    return parseDiffUnified(raw);
  }

  async getRepoRoot(repoUrl: string): Promise<string> {
    try {
      const stdout = await this.execGit(['rev-parse', '--show-toplevel'], repoUrl);
      return stdout.trim();
    } catch {
      return repoUrl;
    }
  }

  async getCat(repoUrl: string, filePath: string, revision: string | number): Promise<string> {
    const args = ['show', `${revision}:${filePath}`];
    return this.execGit(args, repoUrl);
  }

  async getBlame(repoUrl: string, filePath: string): Promise<BlameLine[]> {
    const args = ['blame', '--line-porcelain', filePath];
    const stdout = await this.execGit(args, repoUrl);
    return this.parseGitBlame(stdout);
  }

  async getBlameAtRevision(repoUrl: string, filePath: string, revision: string | number): Promise<BlameLine[]> {
    const args = ['blame', '--line-porcelain', String(revision), '--', filePath];
    const stdout = await this.execGit(args, repoUrl);
    return this.parseGitBlame(stdout);
  }

  private parseGitBlame(output: string): BlameLine[] {
    const lines = output.split('\n');
    const blameLines: BlameLine[] = [];
    
    let currentHash = '';
    let currentAuthor = '';
    let currentDate = '';
    let currentLineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {continue;}
        
        if (line.match(/^[0-9a-f]{40} \d+ \d+/)) {
            const parts = line.split(' ');
            currentHash = parts[0];
            currentLineNumber = parseInt(parts[2], 10);
        } else if (line.startsWith('author ')) {
            currentAuthor = line.substring(7);
        } else if (line.startsWith('author-time ')) {
            const timestamp = parseInt(line.substring(12), 10) * 1000;
            currentDate = new Date(timestamp).toISOString();
        } else if (line.startsWith('\t')) {
            const content = line.substring(1);
            blameLines.push({
                lineNumber: currentLineNumber,
                revision: currentHash as any,
                author: currentAuthor,
                date: currentDate,
                content: content
            });
        }
    }
    
    return blameLines;
  }

  async getInfo(localPath: string): Promise<{ repositoryRoot: string; relativeUrl: string; url: string } | null> {
    try {
      const root = await this.getRepoRoot(localPath);
      // For Git, 'url' might be the remote URL
      const url = await this.execGit(['config', '--get', 'remote.origin.url'], localPath);
      return {
        repositoryRoot: root,
        url: url.trim(),
        relativeUrl: localPath.replace(root, '').replace(/^[\\\/]/, '')
      };
    } catch {
      return null;
    }
  }
}
