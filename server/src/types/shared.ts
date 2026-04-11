/**
 * Shared types between server and client.
 */

export type UserRole = 'reviewer' | 'reviewee';

export interface IUser {
  _id?: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  parentReviewer: string | null; // reviewee's parent reviewer username
  createdAt: Date;
}

export interface ISession {
  _id?: string;
  sessionId: string; // UUID, matches client-side id
  name: string;
  createdAt: string;
  repoUrl: string;
  startDate: string;
  endDate: string;
  authors: string[];
  ownerUsername: string; // reviewer who created this session
}

export interface IReviewLog {
  _id?: string;
  reviewLogId: string; // UUID
  sessionId: string;
  filePath: string;
  author: string; // SVN/Git author
  status: 'pending' | 'approved' | 'flagged';
  reviewedAt?: string;
  baseRevision?: number;
  endRevision?: number;
  aiAudited: boolean;
  ownerUsername: string;
}

export interface IComment {
  _id?: string;
  commentId: string; // UUID
  reviewLogId: string;
  lineNumber: number;
  codeSnippet?: string;
  commentText: string;
  revision?: string;
  createdAt: string;
  ownerUsername: string;
}

export interface IReviewSummary {
  _id?: string;
  summaryId: string;
  sessionId: string;
  author: string;
  summary: string;
  updatedAt: string;
  ownerUsername: string;
}

export interface IInputHistory {
  _id?: string;
  type: 'repo_url' | 'author';
  value: string;
  usedAt: string;
  ownerUsername: string;
}

export interface ISettings {
  _id?: string;
  ownerUsername: string;
  svnUsername?: string;
  svnPassword?: string;
  aiModel: string;
  codingStandards?: string;
  excludePatterns?: string;
  debugMode: boolean;
  language?: string;
}

export interface IAIModel {
  _id?: string;
  modelId: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
  ownerUsername: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: UserRole;
  parentReviewer: string | null;
}

export interface JwtPayload {
  username: string;
  role: UserRole;
  parentReviewer: string | null;
}
