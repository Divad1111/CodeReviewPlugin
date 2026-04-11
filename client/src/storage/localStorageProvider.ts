/**
 * Local storage provider — wraps existing SQLite repo functions.
 * Used in standalone (offline) mode.
 */

import { IStorageProvider } from './storageProvider';
import { AuditSession, ReviewLog, ReviewComment } from '../svn/types';
import { AppSettings, AIModelConfig } from './settingsRepo';
import { ReviewSummary } from './summaryRepo';

// Import all existing repo functions
import * as sessionRepo from './sessionRepo';
import * as reviewRepo from './reviewRepo';
import * as commentRepo from './commentRepo';
import * as summaryRepo from './summaryRepo';
import * as historyRepo from './historyRepo';
import * as settingsRepo from './settingsRepo';

export class LocalStorageProvider implements IStorageProvider {
  constructor(private storagePath: string) {}

  // --- Session ---
  async getSessions(): Promise<AuditSession[]> {
    return sessionRepo.getSessions();
  }

  async getSessionById(id: string): Promise<AuditSession | null> {
    return sessionRepo.getSessionById(id);
  }

  async createSession(name: string, repoUrl: string, startDate: string, endDate: string, authors: string[]): Promise<AuditSession> {
    return sessionRepo.createSession(name, repoUrl, startDate, endDate, authors, this.storagePath);
  }

  async renameSession(id: string, newName: string): Promise<void> {
    sessionRepo.renameSession(id, newName, this.storagePath);
  }

  async updateSessionAuthors(id: string, authors: string[]): Promise<void> {
    sessionRepo.updateSessionAuthors(id, authors, this.storagePath);
  }

  async deleteSession(id: string): Promise<void> {
    sessionRepo.deleteSession(id, this.storagePath);
  }

  // --- ReviewLog ---
  async upsertReviewLog(sessionId: string, filePath: string, author: string, baseRevision?: number, endRevision?: number): Promise<ReviewLog> {
    return reviewRepo.upsertReviewLog(sessionId, filePath, author, this.storagePath, baseRevision, endRevision);
  }

  async getReviewLogById(id: string): Promise<ReviewLog | null> {
    return reviewRepo.getReviewLogById(id);
  }

  async getReviewLogsBySession(sessionId: string): Promise<ReviewLog[]> {
    return reviewRepo.getReviewLogsBySession(sessionId);
  }

  async getReviewLogsByAuthor(sessionId: string, author: string): Promise<ReviewLog[]> {
    return reviewRepo.getReviewLogsByAuthor(sessionId, author);
  }

  async updateReviewStatus(id: string, status: 'pending' | 'approved' | 'flagged'): Promise<void> {
    reviewRepo.updateReviewStatus(id, status, this.storagePath);
  }

  async deleteReviewLog(id: string): Promise<void> {
    reviewRepo.deleteReviewLog(id, this.storagePath);
  }

  async deleteReviewLogsByAuthor(sessionId: string, author: string): Promise<void> {
    reviewRepo.deleteReviewLogsByAuthor(sessionId, author, this.storagePath);
  }

  async updateAiAuditStatus(id: string, audited: boolean): Promise<void> {
    reviewRepo.updateAiAuditStatus(id, audited, this.storagePath);
  }

  // --- Comment ---
  async addComment(reviewLogId: string, lineNumber: number, commentText: string, codeSnippet?: string, revision?: string): Promise<ReviewComment> {
    return commentRepo.addComment(reviewLogId, lineNumber, commentText, this.storagePath, codeSnippet, revision);
  }

  async getCommentsByReviewLog(reviewLogId: string): Promise<ReviewComment[]> {
    return commentRepo.getCommentsByReviewLog(reviewLogId);
  }

  async getCommentCount(reviewLogId: string): Promise<number> {
    return commentRepo.getCommentCount(reviewLogId);
  }

  async updateComment(commentId: string, newText: string): Promise<void> {
    commentRepo.updateComment(commentId, newText, this.storagePath);
  }

  async deleteComment(commentId: string): Promise<void> {
    commentRepo.deleteComment(commentId, this.storagePath);
  }

  async deleteAiComments(reviewLogId: string): Promise<void> {
    commentRepo.deleteAiComments(reviewLogId, this.storagePath);
  }

  // --- Summary ---
  async getSummary(sessionId: string, author: string): Promise<ReviewSummary | null> {
    return summaryRepo.getSummary(sessionId, author);
  }

  async upsertSummary(sessionId: string, author: string, summary: string): Promise<void> {
    summaryRepo.upsertSummary(sessionId, author, summary, this.storagePath);
  }

  async deleteSummary(sessionId: string, author: string): Promise<void> {
    summaryRepo.deleteSummary(sessionId, author, this.storagePath);
  }

  // --- History ---
  async recordHistory(type: 'repo_url' | 'author', value: string): Promise<void> {
    historyRepo.recordHistory(type, value, this.storagePath);
  }

  async getHistory(type: 'repo_url' | 'author'): Promise<string[]> {
    return historyRepo.getHistory(type);
  }

  async deleteHistory(type: 'repo_url' | 'author', value: string): Promise<void> {
    historyRepo.deleteHistory(type, value, this.storagePath);
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    return settingsRepo.getSettings();
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    settingsRepo.updateSettings(settings, this.storagePath);
  }

  async getAIModels(): Promise<AIModelConfig[]> {
    return settingsRepo.getAIModels();
  }

  async getAIModelByName(name: string): Promise<AIModelConfig | null> {
    return settingsRepo.getAIModelByName(name);
  }

  async upsertAIModel(model: Omit<AIModelConfig, 'id' | 'isDefault'>, id?: string): Promise<void> {
    settingsRepo.upsertAIModel(model, this.storagePath, id);
  }

  async deleteAIModel(id: string): Promise<void> {
    settingsRepo.deleteAIModel(id, this.storagePath);
  }

  async importAllSettings(data: any): Promise<void> {
    settingsRepo.importAllSettings(data, this.storagePath);
  }
}
