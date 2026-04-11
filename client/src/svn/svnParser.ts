/**
 * SVN XML and unified diff parsers.
 */

import * as xml2js from 'xml2js';
import { SvnLogEntry, SvnChangedPath, DiffFile, DiffHunk, DiffLine, BlameLine } from './types';

/**
 * Parse `svn log --xml` output into structured log entries.
 */
export async function parseLogXml(xml: string): Promise<SvnLogEntry[]> {
  const result = await xml2js.parseStringPromise(xml, { explicitArray: false });

  if (!result.log || !result.log.logentry) {
    return [];
  }

  const entries = Array.isArray(result.log.logentry)
    ? result.log.logentry
    : [result.log.logentry];

  return entries.map((entry: any): SvnLogEntry => {
    const changedPaths: SvnChangedPath[] = [];
    if (entry.paths && entry.paths.path) {
      const paths = Array.isArray(entry.paths.path)
        ? entry.paths.path
        : [entry.paths.path];
      for (const p of paths) {
        changedPaths.push({
          action: (p.$.action || 'M') as SvnChangedPath['action'],
          path: typeof p === 'string' ? p : p._,
          copyFromPath: p.$?.['copyfrom-path'],
          copyFromRev: p.$?.['copyfrom-rev'] ? parseInt(p.$['copyfrom-rev'], 10) : undefined,
        });
      }
    }

    return {
      revision: parseInt(entry.$.revision, 10),
      author: entry.author || '',
      date: entry.date || '',
      message: entry.msg || '',
      changedPaths,
    };
  });
}

/**
 * Parse `svn blame --xml` output into blame line entries.
 */
export async function parseBlameXml(xml: string): Promise<BlameLine[]> {
  const result = await xml2js.parseStringPromise(xml, { explicitArray: false });

  if (!result.blame || !result.blame.target || !result.blame.target.entry) {
    return [];
  }

  const entries = Array.isArray(result.blame.target.entry)
    ? result.blame.target.entry
    : [result.blame.target.entry];

  return entries.map((entry: any, index: number): BlameLine => {
    const commit = entry.commit || {};
    return {
      lineNumber: parseInt(entry.$?.['line-number'] || String(index + 1), 10),
      revision: parseInt(commit.$.revision || '0', 10),
      author: commit.author || '',
      date: commit.date || '',
      content: '', // Content not included in blame XML, must be matched from file
    };
  });
}

/**
 * Parse unified diff output into structured DiffFile objects.
 */
export function parseDiffUnified(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diffText.split('\n');
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file headers
    if (line.startsWith('--- ')) {
      const oldPath = line.substring(4).replace(/\t.*$/, '').trim();
      const nextLine = lines[i + 1] || '';
      if (nextLine.startsWith('+++ ')) {
        const newPath = nextLine.substring(4).replace(/\t.*$/, '').trim();
        currentFile = { oldPath, newPath, hunks: [] };
        files.push(currentFile);
        i++; // Skip +++ line
        continue;
      }
    }

    // Detect hunk headers: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      oldLineNum = currentHunk.oldStart;
      newLineNum = currentHunk.newStart;
      continue;
    }

    // Parse hunk content
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineNum++,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.substring(1) : line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
      // Ignore "\\ No newline at end of file" and other special lines
    }
  }

  return files;
}
