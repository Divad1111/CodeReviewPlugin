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

export type AuditTreeItemType = 'session' | 'person' | 'file' | 'comment';

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

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  findSessionItem(sessionId: string): AuditTreeItem | undefined {
    return this.sessionItemsMap.get(sessionId);
  }

  getTreeItem(element: AuditTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AuditTreeItem): Thenable<AuditTreeItem[]> {
    if (!element) {
      return this.getSessionNodes();
    }

    switch (element.itemType) {
      case 'session':
        return this.getPersonNodes(element.sessionId!);
      case 'person':
        return this.getFileNodes(element.sessionId!, element.author!);
      case 'file':
        if (element.reviewLog) {
          return this.getCommentNodes(element.reviewLog);
        }
        return Promise.resolve([]);
      default:
        return Promise.resolve([]);
    }
  }

  private async getSessionNodes(): Promise<AuditTreeItem[]> {
    const sessions = getSessions();
    this.sessionItemsMap.clear();

    return sessions.map((s) => {
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
      return item;
    });
  }

  private async getPersonNodes(sessionId: string): Promise<AuditTreeItem[]> {
    const reviewLogs = getReviewLogsBySession(sessionId);
    const authors = new Set(reviewLogs.map(r => r.author));

    return Array.from(authors).sort().map((author) => {
      return new AuditTreeItem(
        author,
        'person',
        vscode.TreeItemCollapsibleState.Expanded,
        sessionId,
        author
      );
    });
  }

  private async getFileNodes(sessionId: string, author: string): Promise<AuditTreeItem[]> {
    const reviewLogs = getReviewLogsBySession(sessionId)
      .filter(r => r.author === author);

    return reviewLogs.map((rl) => {
      const filename = path.basename(rl.filePath);
      const commentCount = getCommentCount(rl.id);
      const collapsibleState = commentCount > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      return new AuditTreeItem(
        filename,
        'file',
        collapsibleState,
        sessionId,
        author,
        rl
      );
    });
  }

  private async getCommentNodes(reviewLog: ReviewLog): Promise<AuditTreeItem[]> {
    const comments = getCommentsByReviewLog(reviewLog.id);
    return comments.map(c => {
      return new AuditTreeItem(
        c.commentText.length > 30 ? c.commentText.substring(0, 30) + '...' : c.commentText,
        'comment',
        vscode.TreeItemCollapsibleState.None,
        reviewLog.sessionId,
        undefined,
        reviewLog,
        undefined,
        c
      );
    });
  }
}
