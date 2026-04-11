/**
 * Authentication manager — handles login, registration, and auth state.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

export type UserRole = 'reviewer' | 'reviewee';
export type AuthMode = 'standalone' | 'server';

export interface AuthState {
  mode: AuthMode;
  serverUrl?: string;
  username?: string;
  token?: string;
  roles?: UserRole[];
  parentReviewer?: string | null;
}

interface LoginResponse {
  token: string;
  username: string;
  roles: UserRole[];
  parentReviewer: string | null;
}

export class AuthManager {
  private state: AuthState = { mode: 'standalone' };
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Login to server.
   */
  async login(serverUrl: string, username: string, password: string): Promise<AuthState> {
    const response = await this.httpPost<LoginResponse>(
      `${serverUrl.replace(/\/+$/, '')}/api/auth/login`,
      { username, password }
    );

    // Double-check roles for compatibility with legacy servers or older accounts
    const roles: UserRole[] = response.roles && response.roles.length > 0
      ? response.roles
      : (response as any).role ? [((response as any).role) as UserRole] : ['reviewee'];

    this.state = {
      mode: 'server',
      serverUrl: serverUrl.replace(/\/+$/, ''),
      username: response.username,
      token: response.token,
      roles: roles,
      parentReviewer: response.parentReviewer,
    };

    console.log(`[SVN Audit] Login successful. Roles: ${JSON.stringify(roles)}`);
    return this.state;
  }

  /**
   * Register a new reviewer account.
   */
  async register(serverUrl: string, username: string, password: string): Promise<void> {
    await this.httpPost(
      `${serverUrl.replace(/\/+$/, '')}/api/auth/register`,
      { username, password }
    );
  }

  /**
   * Enter standalone mode (local SQLite).
   */
  enterStandaloneMode(): void {
    this.state = {
      mode: 'standalone',
      roles: ['reviewer', 'reviewee'], // Standalone always has full access
    };
  }

  /**
   * Logout — reset state.
   */
  async logout(): Promise<void> {
    this.state = { mode: 'standalone' };
    // Clear saved password (keep server URL and username for convenience)
    await this.context.secrets.delete('svnAudit.password');
  }

  // --- State Queries ---
  getAuthState(): AuthState {
    return { ...this.state };
  }

  isLoggedIn(): boolean {
    return this.state.mode === 'server' && !!this.state.token;
  }

  isStandalone(): boolean {
    return this.state.mode === 'standalone';
  }

  isReviewer(): boolean {
    return this.state.roles?.includes('reviewer') ?? false;
  }

  isReviewee(): boolean {
    return this.state.roles?.includes('reviewee') ?? false;
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn() || this.isStandalone();
  }

  // --- Credential Persistence ---
  async saveCredentials(serverUrl: string, username: string, password: string): Promise<void> {
    await this.context.globalState.update('svnAudit.serverUrl', serverUrl);
    await this.context.globalState.update('svnAudit.username', username);
    await this.context.secrets.store('svnAudit.password', password);
  }

  async loadSavedCredentials(): Promise<{ serverUrl: string; username: string; password?: string } | null> {
    const serverUrl = this.context.globalState.get<string>('svnAudit.serverUrl') || '';
    const username = this.context.globalState.get<string>('svnAudit.username') || '';
    const password = await this.context.secrets.get('svnAudit.password');

    // Return what we have, even if password is missing
    if (serverUrl || username) {
      return { serverUrl, username, password: password || undefined };
    }
    return null;
  }

  // --- HTTP Helper ---
  private httpPost<T>(url: string, body: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;
      const bodyStr = JSON.stringify(body);

      const options: http.RequestOptions = {
        method: 'POST',
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsed as T);
          } catch (_e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
