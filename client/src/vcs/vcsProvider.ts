import { SvnLogEntry, BlameLine, DiffFile } from '../svn/types';

export abstract class VcsProvider {
  /**
   * Check if VCS CLI is available in PATH.
   * Shows an error message if not found.
   */
  abstract checkAvailable(): Promise<boolean>;

  /**
   * Fetch VCS log entries for a given URL and date range.
   */
  abstract getLog(repoUrl: string, startDate: string, endDate: string): Promise<SvnLogEntry[]>;

  /**
   * Fetch VCS logs for a specific author in a date range.
   */
  abstract getLogsForAuthor(repoUrl: string, startDate: string, endDate: string, author: string): Promise<SvnLogEntry[]>;

  /**
   * Get unified diff for a specific file between two revisions.
   */
  abstract getDiffForFile(repoUrl: string, filePath: string, revBase: string | number, revEnd: string | number): Promise<string>;

  /**
   * Get unified diff for an entire URL between two revisions.
   */
  abstract getDiff(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<string>;

  /**
   * Get parsed diff files between two revisions.
   */
  abstract getDiffParsed(repoUrl: string, revBase: string | number, revEnd: string | number): Promise<DiffFile[]>;

  /**
   * Get the repository root for a given URL.
   */
  abstract getRepoRoot(repoUrl: string): Promise<string>;

  /**
   * Fetch file content at a specific revision.
   */
  abstract getCat(repoUrl: string, filePath: string, revision: string | number): Promise<string>;

  /**
   * Get blame (annotate) information for a file at HEAD.
   */
  abstract getBlame(repoUrl: string, filePath: string): Promise<BlameLine[]>;

  /**
   * Get blame information for a file at a specific revision.
   */
  abstract getBlameAtRevision(repoUrl: string, filePath: string, revision: string | number): Promise<BlameLine[]>;

  /**
   * Get basic VCS info for a local path or URL.
   */
  abstract getInfo(localPath: string): Promise<{ repositoryRoot: string; relativeUrl: string; url: string } | null>;
}
