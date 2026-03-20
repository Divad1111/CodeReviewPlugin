/**
 * Merge algorithm for computing per-user "clean diff" and detecting overwritten lines.
 */

import { SvnLogEntry, AuthorFileChanges, AuthorFile, BlameLine, OverwrittenLine } from './types';
import { SvnService } from './svnService';

/**
 * Given a list of SVN log entries, compute per-author file change aggregations.
 * Groups by author and finds the base/end revision range per author.
 */
export function aggregateByAuthor(
  logEntries: SvnLogEntry[],
  targetAuthors: string[]
): Map<string, AuthorFileChanges> {
  const authorMap = new Map<string, AuthorFileChanges>();
  const normalizedTargets = targetAuthors.map(a => a.toLowerCase());

  // Sort entries by revision ascending
  const sorted = [...logEntries].sort((a, b) => a.revision - b.revision);

  for (const entry of sorted) {
    const authorLower = entry.author.toLowerCase();
    if (!normalizedTargets.includes(authorLower)) {
      continue;
    }

    if (!authorMap.has(authorLower)) {
      authorMap.set(authorLower, {
        author: entry.author,
        files: [],
        baseRevision: entry.revision,
        endRevision: entry.revision,
      });
    }

    const agg = authorMap.get(authorLower)!;
    agg.endRevision = Math.max(agg.endRevision, entry.revision);
    agg.baseRevision = Math.min(agg.baseRevision, entry.revision);

    for (const changedPath of entry.changedPaths) {
      const existing = agg.files.find(f => f.path === changedPath.path);
      if (existing) {
        if (!existing.revisions.includes(entry.revision)) {
          existing.revisions.push(entry.revision);
        }
        // Use the "most severe" action: D > A > R > M
        if (changedPath.action === 'D') {
          existing.action = 'D';
        } else if (changedPath.action === 'A' && existing.action !== 'D') {
          existing.action = 'A';
        }
      } else {
        agg.files.push({
          path: changedPath.path,
          action: changedPath.action,
          revisions: [entry.revision],
        });
      }
    }
  }

  return authorMap;
}

/**
 * Compute the "clean diff" for a specific author by diffing
 * (firstRevision - 1) vs lastRevision.
 * This produces a merged view of all their changes in the time range.
 */
export async function computeCleanDiff(
  svnService: SvnService,
  repoUrl: string,
  authorChanges: AuthorFileChanges
): Promise<string> {
  const baseRev = authorChanges.baseRevision - 1; // One before first change
  const endRev = authorChanges.endRevision;

  return svnService.getDiff(repoUrl, baseRev, endRev);
}

/**
 * Detect lines that were modified by the target user but have since been
 * overwritten by another user (based on HEAD blame).
 *
 * Logic:
 * 1. Get blame at HEAD for the file
 * 2. For each line in the target user's diff, check if blame shows a different author
 * 3. If blame author ≠ target user AND the line was touched by target user → overwritten
 */
export async function detectOverwrittenLines(
  svnService: SvnService,
  repoUrl: string,
  filePath: string,
  targetAuthor: string,
  authorChanges: AuthorFileChanges
): Promise<OverwrittenLine[]> {
  const overwritten: OverwrittenLine[] = [];

  try {
    // Get blame at HEAD
    const blameLines = await svnService.getBlame(repoUrl, filePath);

    // Get blame at the end revision of author's changes for comparison
    const blameLinesAtEnd = await svnService.getBlameAtRevision(
      repoUrl,
      filePath,
      authorChanges.endRevision
    );

    const targetLower = targetAuthor.toLowerCase();
    const baseRev = authorChanges.baseRevision;
    const endRev = authorChanges.endRevision;

    // Build a set of line numbers that the author touched
    // (lines where blame-at-endRev shows the target author with a revision in range)
    const authorTouchedLines = new Set<number>();
    for (const bl of blameLinesAtEnd) {
      if (
        bl.author.toLowerCase() === targetLower &&
        bl.revision >= baseRev &&
        bl.revision <= endRev
      ) {
        authorTouchedLines.add(bl.lineNumber);
      }
    }

    // Now check HEAD blame for those lines — if author changed, it's overwritten
    for (const bl of blameLines) {
      if (
        authorTouchedLines.has(bl.lineNumber) &&
        bl.author.toLowerCase() !== targetLower
      ) {
        // Find the original content from the end-of-range blame
        const originalBl = blameLinesAtEnd.find(b => b.lineNumber === bl.lineNumber);
        overwritten.push({
          lineNumber: bl.lineNumber,
          filePath,
          originalAuthor: targetAuthor,
          currentAuthor: bl.author,
          originalRevision: originalBl?.revision ?? authorChanges.endRevision,
          currentRevision: bl.revision,
          originalContent: originalBl?.content ?? '',
          currentContent: bl.content,
        });
      }
    }
  } catch (err) {
    // File might have been deleted or is binary — skip silently
    console.warn(`[SVN Audit] Could not detect overwrites for ${filePath}:`, err);
  }

  return overwritten;
}
