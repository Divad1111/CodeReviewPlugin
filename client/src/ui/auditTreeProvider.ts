/**
 * Sidebar TreeView data provider for the SVN Audit extension.
 * Hierarchy: Session → Person → File (with status icons)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AuditSession, ReviewLog } from '../svn/types';
import { getSessions } from '../storage/sessionRepo';
import { getReviewLogsBySession } from '../storage/reviewRepo';
import { getCommentCount, getCommentsByReviewLog } from '../storage/commentRepo';
import { getSettings } from '../storage/settingsRepo';
import { getLocalization } from './localization';
import { getSummary } from '../storage/summaryRepo';

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

  private setupAppearance(): void {
    const settings = getSettings();
    const L = getLocalization(settings.language);

    switch (this.itemType) {
      case 'session': {
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = this.customTooltip || `${L.settingsTitle}: ${this.label}`;
        break;
      }
      case 'person': {
        this.iconPath = new vscode.ThemeIcon('person');
        this.tooltip = this.label;
        break;
      }
      case 'file': {
        if (this.reviewLog) {
          const commentCount = getCommentCount(this.reviewLog.id);
          const statusIcon = this.getStatusIcon(this.reviewLog.status, commentCount, this.reviewLog.aiAudited);
          this.iconPath = statusIcon;
          this.tooltip = `${this.reviewLog.filePath}\nStatus: ${this.reviewLog.status}${commentCount > 0 ? `\nComments: ${commentCount}` : ''}${this.reviewLog.aiAudited ? `\n(${L.aiAuditStart})` : ''}`;

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
    const sessions = getSessions();
    this.sessionItemsMap.clear();

    return sessions.map((s) => {
      const cacheKey = `session:${s.id}`;
      if (this.itemCache.has(cacheKey)) {return this.itemCache.get(cacheKey)!;}

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
    const settings = getSettings();
    const L = getLocalization(settings.language);

    // 1. Add Summary if exists
    const summary = getSummary(sessionId, author);
    if (summary) {
      const cacheKey = `summary:${sessionId}:${author}`;
      const label = L.reviewResult;
      
      let item: AuditTreeItem;
      if (this.itemCache.has(cacheKey)) {
        item = this.itemCache.get(cacheKey)!;
      } else {
        item = new AuditTreeItem(
          label,
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
    const reviewLogs = getReviewLogsBySession(sessionId);
    const authors = new Set(reviewLogs.map(r => r.author));

    return Array.from(authors).sort().map((author) => {
      const cacheKey = `person:${sessionId}:${author}`;
      if (this.itemCache.has(cacheKey)) {return this.itemCache.get(cacheKey)!;}

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
    const reviewLogs = getReviewLogsBySession(sessionId).filter(r => r.author === author);
    const settings = getSettings();
    const excludeInput = settings.excludePatterns || '';
    const excludePatterns = excludeInput.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);

    const filteredLogs = reviewLogs.filter(log => {
      if (excludePatterns.length === 0) {return true;}
      const filename = path.basename(log.filePath);
      
      return !excludePatterns.some((pattern: string) => {
        // Convert glob-like *.ext to simple regex
        const regexStr = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexStr}$`, 'i');
        return regex.test(filename);
      });
    });

    return filteredLogs.map((rl) => {
      const cacheKey = `file:${rl.id}`;
      if (this.itemCache.has(cacheKey)) {return this.itemCache.get(cacheKey)!;}

      const filename = path.basename(rl.filePath);
      const commentCount = getCommentCount(rl.id);
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
      this.itemCache.set(cacheKey, item);
      return item;
    });
  }

  private async getCommentNodes(reviewLog: ReviewLog): Promise<AuditTreeItem[]> {
    const comments = getCommentsByReviewLog(reviewLog.id);
    return comments.map(c => {
      const cacheKey = `comment:${c.id}`;
      if (this.itemCache.has(cacheKey)) {return this.itemCache.get(cacheKey)!;}

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
