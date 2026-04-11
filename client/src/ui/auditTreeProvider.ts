/**
 * Sidebar TreeView data provider for the SVN Audit extension.
 * Hierarchy: Session → Person → File (with status icons)
 * Supports both standalone and server modes with role-based filtering.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AuditSession, ReviewLog } from '../svn/types';
import { StorageContext } from '../storage/storageContext';
import { getLocalization } from './localization';

export type AuditTreeItemType = 'session' | 'person' | 'file' | 'comment' | 'summary';

export class AuditTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: AuditTreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly sessionId?: string,
    public readonly author?: string,
    public readonly reviewLog?: ReviewLog,
    public customTooltip?: string,
    public readonly comment?: any
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;
    this.setupAppearance();
  }

  /** commentCount injected externally for async support */
  public commentCount: number = 0;

  private setupAppearance(): void {
    switch (this.itemType) {
      case 'session': {
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = this.customTooltip || `Session: ${this.label}`;
        break;
      }
      case 'person': {
        this.iconPath = new vscode.ThemeIcon('person');
        this.tooltip = this.label;
        break;
      }
      case 'file': {
        if (this.reviewLog) {
          const statusIcon = this.getStatusIcon(this.reviewLog.status, this.commentCount, this.reviewLog.aiAudited);
          this.iconPath = statusIcon;
          this.tooltip = `${this.reviewLog.filePath}\nStatus: ${this.reviewLog.status}${this.commentCount > 0 ? `\nComments: ${this.commentCount}` : ''}${this.reviewLog.aiAudited ? `\n(AI Audited)` : ''}`;

          // Click opens diff view
          this.command = {
            command: 'svnAudit.openDiff',
            title: 'Open Diff',
            arguments: [this.reviewLog],
          };
        }
        break;
      }
      case 'comment': {
        if (this.comment && this.reviewLog) {
          this.iconPath = new vscode.ThemeIcon('comment-discussion');
          this.tooltip = `Line ${this.comment.lineNumber}: ${this.comment.commentText}`;
          this.description = `Line ${this.comment.lineNumber}`;
          this.command = {
            command: 'svnAudit.openDiff',
            title: 'Open Diff',
            arguments: [this.reviewLog, this.comment],
          };
        }
        break;
      }
      case 'summary': {
        this.iconPath = new vscode.ThemeIcon('checklist', new vscode.ThemeColor('debugIcon.stepOverForeground'));
        this.tooltip = this.customTooltip || this.label;
        this.description = this.customTooltip ? (this.customTooltip.length > 30 ? this.customTooltip.substring(0, 30) + '...' : this.customTooltip) : '';
        this.contextValue = 'summaryNode';
        break;
      }
    }
  }

  private getStatusIcon(status: string, commentCount: number, aiAudited?: boolean): vscode.ThemeIcon {
    if (status === 'approved') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    if (status === 'flagged') {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
    }
    if (commentCount > 0) {
      return new vscode.ThemeIcon('comment', new vscode.ThemeColor('charts.yellow'));
    }
    if (aiAudited) {
      return new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.blue'));
    }
    return new vscode.ThemeIcon('circle-outline');
  }
}

export class AuditTreeDataProvider implements vscode.TreeDataProvider<AuditTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AuditTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessionItemsMap: Map<string, AuditTreeItem> = new Map();
  private parentMap = new WeakMap<AuditTreeItem, AuditTreeItem>();
  private itemCache = new Map<string, AuditTreeItem>();

  refresh(): void {
    this.itemCache.clear();
    this.sessionItemsMap.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  findSessionItem(sessionId: string): AuditTreeItem | undefined {
    return this.sessionItemsMap.get(sessionId);
  }

  getTreeItem(element: AuditTreeItem): vscode.TreeItem {
    return element;
  }

  getParent(element: AuditTreeItem): vscode.ProviderResult<AuditTreeItem> {
    return this.parentMap.get(element);
  }

  async getChildren(element?: AuditTreeItem): Promise<AuditTreeItem[]> {
    // If no provider is set, show nothing (not logged in)
    if (!StorageContext.hasProvider()) {
      return [];
    }

    let children: AuditTreeItem[] = [];
    if (!element) {
      children = await this.getSessionNodes();
    } else {
      switch (element.itemType) {
        case 'session':
          children = await this.getPersonNodes(element.sessionId!);
          break;
        case 'person':
          children = await this.getPersonChildren(element.sessionId!, element.author!);
          break;
        case 'file':
          if (element.reviewLog) {
            children = await this.getCommentNodes(element.reviewLog);
          }
          break;
      }
    }

    // Map parents for reveal
    children.forEach(child => {
      if (element) {
        this.parentMap.set(child, element);
      }
    });

    return children;
  }

  /**
   * Helper to find a specific comment item in the tree hierarchy.
   */
  async findCommentItem(reviewLogId: string, commentId: string): Promise<AuditTreeItem | undefined> {
    const sessions = await this.getChildren();
    for (const sessionItem of sessions) {
      const persons = await this.getChildren(sessionItem);
      for (const personItem of persons) {
        const files = await this.getChildren(personItem);
        for (const fileItem of files) {
          if (fileItem.reviewLog?.id === reviewLogId) {
            const comments = await this.getChildren(fileItem);
            return comments.find(c => c.comment?.id === commentId);
          }
        }
      }
    }
    return undefined;
  }

  private async getSessionNodes(): Promise<AuditTreeItem[]> {
    const provider = StorageContext.getProvider();
    const sessions = await provider.getSessions();
    this.sessionItemsMap.clear();

    return sessions.map((s) => {
      const cacheKey = `session:${s.id}`;
      if (this.itemCache.has(cacheKey)) { return this.itemCache.get(cacheKey)!; }

      const label = `${s.name} (${s.endDate})`;
      const authorList = s.authors.join(', ');
      const tooltip = `${s.name}\n${s.startDate} ↔ ${s.endDate}\nAuthors: ${authorList}`;

      const item = new AuditTreeItem(
        label,
        'session',
        vscode.TreeItemCollapsibleState.Expanded,
        s.id,
        undefined,
        undefined,
        tooltip
      );
      this.sessionItemsMap.set(s.id, item);
      this.itemCache.set(cacheKey, item);
      return item;
    });
  }

  private async getPersonChildren(sessionId: string, author: string): Promise<AuditTreeItem[]> {
    const children: AuditTreeItem[] = [];
    const provider = StorageContext.getProvider();

    // 1. Add Summary if exists
    const summary = await provider.getSummary(sessionId, author);
    if (summary) {
      const cacheKey = `summary:${sessionId}:${author}`;

      let item: AuditTreeItem;
      if (this.itemCache.has(cacheKey)) {
        item = this.itemCache.get(cacheKey)!;
      } else {
        item = new AuditTreeItem(
          'Review Result',
          'summary',
          vscode.TreeItemCollapsibleState.None,
          sessionId,
          author,
          undefined,
          summary.summary
        );
        this.itemCache.set(cacheKey, item);
      }
      children.push(item);
    }

    // 2. Add Files
    const files = await this.getFileNodes(sessionId, author);
    children.push(...files);

    return children;
  }

  private async getPersonNodes(sessionId: string): Promise<AuditTreeItem[]> {
    const provider = StorageContext.getProvider();
    const reviewLogs = await provider.getReviewLogsBySession(sessionId);
    const authors = new Set(reviewLogs.map(r => r.author));

    return Array.from(authors).sort().map((author) => {
      const cacheKey = `person:${sessionId}:${author}`;
      if (this.itemCache.has(cacheKey)) { return this.itemCache.get(cacheKey)!; }

      const item = new AuditTreeItem(
        author,
        'person',
        vscode.TreeItemCollapsibleState.Expanded,
        sessionId,
        author
      );
      this.itemCache.set(cacheKey, item);
      return item;
    });
  }

  private async getFileNodes(sessionId: string, author: string): Promise<AuditTreeItem[]> {
    const provider = StorageContext.getProvider();
    const reviewLogs = await provider.getReviewLogsBySession(sessionId);
    const authorLogs = reviewLogs.filter(r => r.author === author);

    const settings = await provider.getSettings();
    const excludeInput = settings.excludePatterns || '';
    const excludePatterns = excludeInput.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);

    const filteredLogs = authorLogs.filter(log => {
      if (excludePatterns.length === 0) { return true; }
      const filename = path.basename(log.filePath);

      return !excludePatterns.some((pattern: string) => {
        const regexStr = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexStr}$`, 'i');
        return regex.test(filename);
      });
    });

    // Fetch comment counts in parallel
    const items: AuditTreeItem[] = [];
    for (const rl of filteredLogs) {
      const cacheKey = `file:${rl.id}`;
      if (this.itemCache.has(cacheKey)) {
        items.push(this.itemCache.get(cacheKey)!);
        continue;
      }

      const commentCount = await provider.getCommentCount(rl.id);
      const filename = path.basename(rl.filePath);
      const collapsibleState = commentCount > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      const item = new AuditTreeItem(
        filename,
        'file',
        collapsibleState,
        sessionId,
        author,
        rl
      );
      item.commentCount = commentCount;
      // Re-call setupAppearance after setting commentCount
      (item as any).setupAppearance();

      this.itemCache.set(cacheKey, item);
      items.push(item);
    }

    return items;
  }

  private async getCommentNodes(reviewLog: ReviewLog): Promise<AuditTreeItem[]> {
    const provider = StorageContext.getProvider();
    const comments = await provider.getCommentsByReviewLog(reviewLog.id);
    return comments.map(c => {
      const cacheKey = `comment:${c.id}`;
      if (this.itemCache.has(cacheKey)) { return this.itemCache.get(cacheKey)!; }

      const item = new AuditTreeItem(
        c.commentText.length > 30 ? c.commentText.substring(0, 30) + '...' : c.commentText,
        'comment',
        vscode.TreeItemCollapsibleState.None,
        reviewLog.sessionId,
        undefined,
        reviewLog,
        undefined,
        c
      );
      this.itemCache.set(cacheKey, item);
      return item;
    });
  }
}
