/**
 * Sidebar TreeView data provider for the SVN Audit extension.
 * Hierarchy: Session → Person → File (with status icons)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AuditSession, ReviewLog } from '../svn/types';
import { getSessions } from '../storage/sessionRepo';
import { getReviewLogsBySession } from '../storage/reviewRepo';
import { getCommentCount } from '../storage/commentRepo';

export type AuditTreeItemType = 'session' | 'person' | 'file';

export class AuditTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: AuditTreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly sessionId?: string,
    public readonly author?: string,
    public readonly reviewLog?: ReviewLog
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;
    this.setupAppearance();
  }

  private setupAppearance(): void {
    switch (this.itemType) {
      case 'session': {
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = `Session: ${this.label}`;
        break;
      }
      case 'person': {
        this.iconPath = new vscode.ThemeIcon('person');
        this.tooltip = `Author: ${this.label}`;
        break;
      }
      case 'file': {
        if (this.reviewLog) {
          const commentCount = getCommentCount(this.reviewLog.id);
          const statusIcon = this.getStatusIcon(this.reviewLog.status, commentCount);
          this.iconPath = statusIcon;
          this.tooltip = `${this.reviewLog.filePath}\nStatus: ${this.reviewLog.status}${commentCount > 0 ? `\nComments: ${commentCount}` : ''}`;

          // Click opens diff view
          this.command = {
            command: 'svnAudit.openDiff',
            title: 'Open Diff',
            arguments: [this.reviewLog],
          };
        }
        break;
      }
    }
  }

  private getStatusIcon(status: string, commentCount: number): vscode.ThemeIcon {
    if (status === 'approved') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    if (status === 'flagged') {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
    }
    if (commentCount > 0) {
      return new vscode.ThemeIcon('comment', new vscode.ThemeColor('charts.yellow'));
    }
    return new vscode.ThemeIcon('circle-outline');
  }
}

export class AuditTreeDataProvider implements vscode.TreeDataProvider<AuditTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AuditTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
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
      default:
        return Promise.resolve([]);
    }
  }

  private async getSessionNodes(): Promise<AuditTreeItem[]> {
    const sessions = getSessions();
    return sessions.map((s) => {
      const dateStr = new Date(s.createdAt).toLocaleDateString();
      const label = `${dateStr} — ${s.authors.join(', ')}`;
      return new AuditTreeItem(
        label,
        'session',
        vscode.TreeItemCollapsibleState.Expanded,
        s.id
      );
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
      return new AuditTreeItem(
        filename,
        'file',
        vscode.TreeItemCollapsibleState.None,
        sessionId,
        author,
        rl
      );
    });
  }
}
