/**
 * Remote storage provider — calls server REST API.
 * Used in server mode (with MongoDB backend).
 */

import { IStorageProvider } from './storageProvider';
import { AuditSession, ReviewLog, ReviewComment } from '../svn/types';
import { AppSettings, AIModelConfig } from './settingsRepo';
import { ReviewSummary } from './summaryRepo';
import * as https from 'https';
import * as http from 'http';

export class RemoteStorageProvider implements IStorageProvider {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const bodyStr = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        method,
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              const errorBody = data ? JSON.parse(data) : {};
              reject(new Error(errorBody.error || `HTTP ${res.statusCode}`));
              return;
            }
            const parsed = data ? JSON.parse(data) : null;
            resolve(parsed as T);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  // --- Session ---
  async getSessions(): Promise<AuditSession[]> {
    return this.request<AuditSession[]>('GET', '/api/sessions');
  }

  async getSessionById(id: string): Promise<AuditSession | null> {
    try {
      return await this.request<AuditSession>('GET', `/api/sessions/${id}`);
    } catch {
      return null;
    }
  }

  async createSession(name: string, repoUrl: string, startDate: string, endDate: string, authors: string[]): Promise<AuditSession> {
    return this.request<AuditSession>('POST', '/api/sessions', { name, repoUrl, startDate, endDate, authors });
  }

  async renameSession(id: string, newName: string): Promise<void> {
    await this.request('PUT', `/api/sessions/${id}`, { name: newName });
  }

  async updateSessionAuthors(id: string, authors: string[]): Promise<void> {
    await this.request('PUT', `/api/sessions/${id}`, { authors });
  }

  async deleteSession(id: string): Promise<void> {
    await this.request('DELETE', `/api/sessions/${id}`);
  }

  // --- ReviewLog ---
  async upsertReviewLog(sessionId: string, filePath: string, author: string, baseRevision?: number, endRevision?: number): Promise<ReviewLog> {
    return this.request<ReviewLog>('POST', '/api/review-logs', { sessionId, filePath, author, baseRevision, endRevision });
  }

  async getReviewLogById(id: string): Promise<ReviewLog | null> {
    try {
      return await this.request<ReviewLog>('GET', `/api/review-logs/${id}`);
    } catch {
      return null;
    }
  }

  async getReviewLogsBySession(sessionId: string): Promise<ReviewLog[]> {
    return this.request<ReviewLog[]>('GET', `/api/review-logs?sessionId=${encodeURIComponent(sessionId)}`);
  }

  async getReviewLogsByAuthor(sessionId: string, author: string): Promise<ReviewLog[]> {
    return this.request<ReviewLog[]>('GET', `/api/review-logs?sessionId=${encodeURIComponent(sessionId)}&author=${encodeURIComponent(author)}`);
  }

  async updateReviewStatus(id: string, status: 'pending' | 'approved' | 'flagged'): Promise<void> {
    await this.request('PUT', `/api/review-logs/${id}`, { status });
  }

  async deleteReviewLog(id: string): Promise<void> {
    await this.request('DELETE', `/api/review-logs/${id}`);
  }

  async deleteReviewLogsByAuthor(sessionId: string, author: string): Promise<void> {
    await this.request('DELETE', `/api/review-logs?sessionId=${encodeURIComponent(sessionId)}&author=${encodeURIComponent(author)}`);
  }

  async updateAiAuditStatus(id: string, audited: boolean): Promise<void> {
    await this.request('PUT', `/api/review-logs/${id}`, { aiAudited: audited });
  }

  // --- Comment ---
  async addComment(reviewLogId: string, lineNumber: number, commentText: string, codeSnippet?: string, revision?: string): Promise<ReviewComment> {
    return this.request<ReviewComment>('POST', '/api/comments', { reviewLogId, lineNumber, commentText, codeSnippet, revision });
  }

  async getCommentsByReviewLog(reviewLogId: string): Promise<ReviewComment[]> {
    return this.request<ReviewComment[]>('GET', `/api/comments?reviewLogId=${encodeURIComponent(reviewLogId)}`);
  }

  async getCommentCount(reviewLogId: string): Promise<number> {
    const result = await this.request<{ count: number }>('GET', `/api/comments/count?reviewLogId=${encodeURIComponent(reviewLogId)}`);
    return result.count;
  }

  async updateComment(commentId: string, newText: string): Promise<void> {
    await this.request('PUT', `/api/comments/${commentId}`, { commentText: newText });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.request('DELETE', `/api/comments/${commentId}`);
  }

  async deleteAiComments(reviewLogId: string): Promise<void> {
    await this.request('DELETE', `/api/comments?reviewLogId=${encodeURIComponent(reviewLogId)}&aiOnly=true`);
  }

  // --- Summary ---
  async getSummary(sessionId: string, author: string): Promise<ReviewSummary | null> {
    return this.request<ReviewSummary | null>('GET', `/api/summaries?sessionId=${encodeURIComponent(sessionId)}&author=${encodeURIComponent(author)}`);
  }

  async upsertSummary(sessionId: string, author: string, summary: string): Promise<void> {
    await this.request('POST', '/api/summaries', { sessionId, author, summary });
  }

  async deleteSummary(sessionId: string, author: string): Promise<void> {
    await this.request('DELETE', `/api/summaries?sessionId=${encodeURIComponent(sessionId)}&author=${encodeURIComponent(author)}`);
  }

  // --- History ---
  async recordHistory(type: 'repo_url' | 'author', value: string): Promise<void> {
    await this.request('POST', '/api/history', { type, value });
  }

  async getHistory(type: 'repo_url' | 'author'): Promise<string[]> {
    return this.request<string[]>('GET', `/api/history?type=${encodeURIComponent(type)}`);
  }

  async deleteHistory(type: 'repo_url' | 'author', value: string): Promise<void> {
    await this.request('DELETE', `/api/history?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`);
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>('GET', '/api/settings');
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    await this.request('PUT', '/api/settings', settings);
  }

  async getAIModels(): Promise<AIModelConfig[]> {
    return this.request<AIModelConfig[]>('GET', '/api/settings/ai-models');
  }

  async getAIModelByName(name: string): Promise<AIModelConfig | null> {
    return this.request<AIModelConfig | null>('GET', `/api/settings/ai-models/by-name/${encodeURIComponent(name)}`);
  }

  async upsertAIModel(model: Omit<AIModelConfig, 'id' | 'isDefault'>, id?: string): Promise<void> {
    await this.request('POST', '/api/settings/ai-models', { ...model, id });
  }

  async deleteAIModel(id: string): Promise<void> {
    await this.request('DELETE', `/api/settings/ai-models/${id}`);
  }

  async importAllSettings(data: any): Promise<void> {
    await this.request('POST', '/api/settings/import', data);
  }
}
