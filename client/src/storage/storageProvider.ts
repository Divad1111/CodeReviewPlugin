/**
 * Storage provider interface — unified data access layer.
 * Supports both local SQLite and remote MongoDB backends.
 */

import { AuditSession, ReviewLog, ReviewComment } from '../svn/types';
import { AppSettings, AIModelConfig } from './settingsRepo';
import { ReviewSummary } from './summaryRepo';

export interface IStorageProvider {
  // --- Session ---
  getSessions(): Promise<AuditSession[]>;
  getSessionById(id: string): Promise<AuditSession | null>;
  createSession(name: string, repoUrl: string, startDate: string, endDate: string, authors: string[]): Promise<AuditSession>;
  renameSession(id: string, newName: string): Promise<void>;
  updateSessionAuthors(id: string, authors: string[]): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // --- ReviewLog ---
  upsertReviewLog(sessionId: string, filePath: string, author: string, baseRevision?: number, endRevision?: number): Promise<ReviewLog>;
  getReviewLogById(id: string): Promise<ReviewLog | null>;
  getReviewLogsBySession(sessionId: string): Promise<ReviewLog[]>;
  getReviewLogsByAuthor(sessionId: string, author: string): Promise<ReviewLog[]>;
  updateReviewStatus(id: string, status: 'pending' | 'approved' | 'flagged'): Promise<void>;
  deleteReviewLog(id: string): Promise<void>;
  deleteReviewLogsByAuthor(sessionId: string, author: string): Promise<void>;
  updateAiAuditStatus(id: string, audited: boolean): Promise<void>;

  // --- Comment ---
  addComment(reviewLogId: string, lineNumber: number, commentText: string, codeSnippet?: string, revision?: string): Promise<ReviewComment>;
  getCommentsByReviewLog(reviewLogId: string): Promise<ReviewComment[]>;
  getCommentCount(reviewLogId: string): Promise<number>;
  updateComment(commentId: string, newText: string): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  deleteAiComments(reviewLogId: string): Promise<void>;

  // --- Summary ---
  getSummary(sessionId: string, author: string): Promise<ReviewSummary | null>;
  upsertSummary(sessionId: string, author: string, summary: string): Promise<void>;
  deleteSummary(sessionId: string, author: string): Promise<void>;

  // --- History ---
  recordHistory(type: 'repo_url' | 'author', value: string): Promise<void>;
  getHistory(type: 'repo_url' | 'author'): Promise<string[]>;
  deleteHistory(type: 'repo_url' | 'author', value: string): Promise<void>;

  // --- Settings ---
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<void>;
  getAIModels(): Promise<AIModelConfig[]>;
  getAIModelByName(name: string): Promise<AIModelConfig | null>;
  upsertAIModel(model: Omit<AIModelConfig, 'id' | 'isDefault'>, id?: string): Promise<void>;
  deleteAIModel(id: string): Promise<void>;
  importAllSettings(data: any): Promise<void>;
}
