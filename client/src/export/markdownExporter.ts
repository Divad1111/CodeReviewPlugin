import * as path from 'path';
import { AuditSession, ReviewLog, ReviewComment } from '../svn/types';
import { getSessionById } from '../storage/sessionRepo';
import { getReviewLogsBySession, getReviewLogsByAuthor } from '../storage/reviewRepo';
import { getCommentsByReviewLog } from '../storage/commentRepo';
import { getSettings } from '../storage/settingsRepo';
import { getLocalization } from '../ui/localization';
import { getSummary } from '../storage/summaryRepo';

/**
 * Generate a Markdown report for a given session.
 */
export function generateMarkdownReport(sessionId: string, targetAuthor?: string): string {
  const settings = getSettings();
  const L = getLocalization(settings.language);
  const session = getSessionById(sessionId);

  if (!session) {
    return `# Error\n\nSession not found.`;
  }

  // 1. Fetch and filter logs (only those with comments)
  const allLogs = targetAuthor 
    ? getReviewLogsByAuthor(sessionId, targetAuthor)
    : getReviewLogsBySession(sessionId);

  const logsWithComments = allLogs.map(log => ({
    log,
    comments: getCommentsByReviewLog(log.id)
  })).filter(entry => entry.comments.length > 0);

  const lines: string[] = [];

  // Header
  lines.push(`# ${L.reportHeader}${targetAuthor ? `: ${targetAuthor}` : ''}`);
  lines.push('');
  lines.push(`## ${L.sessionInfo}`);
  lines.push('');
  lines.push(`| ${L.language === 'zh' ? '字段' : 'Field'} | ${L.language === 'zh' ? '内容' : 'Value'} |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Session ID** | \`${session.id}\` |`);
  lines.push(`| **${L.language === 'zh' ? '创建时间' : 'Created'}** | ${new Date(session.createdAt).toLocaleString()} |`);
  lines.push(`| **${L.language === 'zh' ? '代码库' : 'Repository'}** | ${session.repoUrl} |`);
  lines.push(`| **${L.language === 'zh' ? '时间范围' : 'Date Range'}** | ${session.startDate} — ${session.endDate} |`);
  lines.push(`| **${L.language === 'zh' ? '作者' : 'Authors'}** | ${session.authors.join(', ')} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary statistics (Based on filtered logs)
  const totalFiles = logsWithComments.length;
  const approvedFiles = logsWithComments.filter(e => e.log.status === 'approved').length;
  const flaggedFiles = logsWithComments.filter(e => e.log.status === 'flagged').length;
  const pendingFiles = logsWithComments.filter(e => e.log.status === 'pending').length;

  lines.push(`## ${L.summaryStats}`);
  lines.push('');
  lines.push(`| ${L.language === 'zh' ? '状态' : 'Status'} | ${L.language === 'zh' ? '数量' : 'Count'} |`);
  lines.push(`|--------|-------|`);
  lines.push(`| ✅ ${L.language === 'zh' ? '已通过' : 'Approved'} | ${approvedFiles} |`);
  lines.push(`| ❌ ${L.language === 'zh' ? '有风险' : 'Flagged'} | ${flaggedFiles} |`);
  lines.push(`| ⬜ ${L.language === 'zh' ? '待处理' : 'Pending'} | ${pendingFiles} |`);
  lines.push(`| **${L.language === 'zh' ? '总计' : 'Total'}** | **${totalFiles}** |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by author
  const authorGroups = new Map<string, typeof logsWithComments>();
  for (const entry of logsWithComments) {
    if (!authorGroups.has(entry.log.author)) {
      authorGroups.set(entry.log.author, []);
    }
    authorGroups.get(entry.log.author)!.push(entry);
  }

  // Per-author sections
  for (const [author, entries] of authorGroups) {
    lines.push(`## ${L.authorSection}: ${author}`);
    lines.push('');

    // Add Review Summary if exists
    const summary = getSummary(sessionId, author);
    if (summary && summary.summary) {
      lines.push(`### 📝 ${L.reviewSummary}`);
      lines.push('');
      lines.push(summary.summary);
      lines.push('');
    }

    for (const { log: rl, comments } of entries) {
      const statusIcon = rl.status === 'approved' ? '✅' : rl.status === 'flagged' ? '❌' : '⬜';

      lines.push(`### ${statusIcon} ${rl.filePath}`);
      lines.push('');

      if (rl.baseRevision && rl.endRevision) {
        lines.push(`- **${L.revRange}**: r${rl.baseRevision} — r${rl.endRevision}`);
      }
      lines.push(`- **${L.language === 'zh' ? '状态' : 'Status'}**: ${rl.status}`);
      if (rl.reviewedAt) {
        lines.push(`- **${L.reviewedAt}**: ${new Date(rl.reviewedAt).toLocaleString()}`);
      }
      lines.push('');

      // Comments
      lines.push(`#### ${L.language === 'zh' ? '代码评论' : 'Comments'} (${comments.length})`);
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

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
