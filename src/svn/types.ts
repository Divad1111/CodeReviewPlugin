/**
 * SVN data types used throughout the extension.
 */

/** A single SVN log entry */
export interface SvnLogEntry {
  revision: number;
  author: string;
  date: string; // ISO date string
  message: string;
  changedPaths: SvnChangedPath[];
}

/** A path changed in a log entry */
export interface SvnChangedPath {
  action: 'A' | 'M' | 'D' | 'R'; // Add, Modify, Delete, Replace
  path: string;
  copyFromPath?: string;
  copyFromRev?: number;
}

/** A parsed unified diff for a single file */
export interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
}

/** A single hunk in a unified diff */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/** A single line in a diff hunk */
export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** A blame entry for a single line */
export interface BlameLine {
  lineNumber: number;
  revision: number;
  author: string;
  date: string;
  content: string;
}

/** An overwritten line detected by blame analysis */
export interface OverwrittenLine {
  lineNumber: number;
  filePath: string;
  originalAuthor: string;
  currentAuthor: string;
  originalRevision: number;
  currentRevision: number;
  originalContent: string;
  currentContent: string;
}

/** Session data for a review batch */
export interface AuditSession {
  id: string;
  createdAt: string;
  repoUrl: string;
  startDate: string;
  endDate: string;
  authors: string[];
}

/** Per-file review status */
export interface ReviewLog {
  id: string;
  sessionId: string;
  filePath: string;
  author: string;
  status: 'pending' | 'approved' | 'flagged';
  reviewedAt?: string;
  baseRevision?: number;
  endRevision?: number;
}

/** A review comment on a specific line */
export interface ReviewComment {
  id: string;
  reviewLogId: string;
  lineNumber: number;
  codeSnippet?: string;
  commentText: string;
  revision?: string;
  createdAt: string;
}

/** Per-author aggregation of file changes */
export interface AuthorFileChanges {
  author: string;
  files: AuthorFile[];
  baseRevision: number;
  endRevision: number;
}

/** A file with change info for a specific author */
export interface AuthorFile {
  path: string;
  action: 'A' | 'M' | 'D' | 'R';
  revisions: number[];
}
