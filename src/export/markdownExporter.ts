/**
 * Markdown report export.
 * Generates a Markdown file grouped by author → file → comments.
 */

import * as path from 'path';
import { AuditSession, ReviewLog, ReviewComment } from '../svn/types';
import { getSessionById, getSessions } from '../storage/sessionRepo';
import { getReviewLogsBySession } from '../storage/reviewRepo';
import { getCommentsByReviewLog } from '../storage/commentRepo';

/**
 * Generate a Markdown report for a given session.
 */
export function generateMarkdownReport(sessionId: string): string {
  const session = getSessionById(sessionId);
  if (!session) {
    return '# Error\n\nSession not found.';
  }

  const reviewLogs = getReviewLogsBySession(sessionId);

  // Group by author
  const authorGroups = new Map<string, ReviewLog[]>();
  for (const rl of reviewLogs) {
    if (!authorGroups.has(rl.author)) {
      authorGroups.set(rl.author, []);
    }
    authorGroups.get(rl.author)!.push(rl);
  }

  const lines: string[] = [];

  // Header
  lines.push(`# SVN Audit Report`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Session ID** | \`${session.id}\` |`);
  lines.push(`| **Created** | ${new Date(session.createdAt).toLocaleString()} |`);
  lines.push(`| **Repository** | ${session.repoUrl} |`);
  lines.push(`| **Date Range** | ${session.startDate} — ${session.endDate} |`);
  lines.push(`| **Authors** | ${session.authors.join(', ')} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary statistics
  const totalFiles = reviewLogs.length;
  const approvedFiles = reviewLogs.filter(r => r.status === 'approved').length;
  const flaggedFiles = reviewLogs.filter(r => r.status === 'flagged').length;
  const pendingFiles = reviewLogs.filter(r => r.status === 'pending').length;

  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| ✅ Approved | ${approvedFiles} |`);
  lines.push(`| ❌ Flagged | ${flaggedFiles} |`);
  lines.push(`| ⬜ Pending | ${pendingFiles} |`);
  lines.push(`| **Total** | **${totalFiles}** |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Per-author sections
  for (const [author, logs] of authorGroups) {
    lines.push(`## Author: ${author}`);
    lines.push('');

    for (const rl of logs) {
      const statusIcon = rl.status === 'approved' ? '✅' : rl.status === 'flagged' ? '❌' : '⬜';
      const fileName = path.basename(rl.filePath);

      lines.push(`### ${statusIcon} ${rl.filePath}`);
      lines.push('');

      if (rl.baseRevision && rl.endRevision) {
        lines.push(`- **Revisions**: r${rl.baseRevision} — r${rl.endRevision}`);
      }
      lines.push(`- **Status**: ${rl.status}`);
      if (rl.reviewedAt) {
        lines.push(`- **Reviewed at**: ${new Date(rl.reviewedAt).toLocaleString()}`);
      }
      lines.push('');

      // Comments
      const comments = getCommentsByReviewLog(rl.id);
      if (comments.length > 0) {
        lines.push('#### Comments');
        lines.push('');
        for (const c of comments) {
          lines.push(`- **Line ${c.lineNumber}**: ${c.commentText}`);
          if (c.codeSnippet) {
            lines.push(`  \`\`\`\n  ${c.codeSnippet}\n  \`\`\``);
          }
          lines.push(`  *(${new Date(c.createdAt).toLocaleString()})*`);
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
