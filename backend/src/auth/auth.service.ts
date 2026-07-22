import { Injectable, Logger } from '@nestjs/common';

export interface YahooTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms timestamp
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private tokens: YahooTokens | null = null;

  private get clientId() { return process.env.YAHOO_CLIENT_ID ?? ''; }
  private get clientSecret() { return process.env.YAHOO_CLIENT_SECRET ?? ''; }
  private get redirectUri() { return process.env.YAHOO_REDIRECT_URI ?? ''; }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
    });
    return `https://api.login.yahoo.com/oauth2/request_auth?${params}`;
  }

  async exchangeCode(code: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    this.logger.log('Yahoo OAuth tokens stored successfully');
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.tokens) throw new Error('Not authenticated with Yahoo');

    // Refresh if within 5 minutes of expiry
    if (Date.now() > this.tokens.expiresAt - 5 * 60 * 1000) {
      await this.refreshTokens();
    }

    return this.tokens.accessToken;
  }

  private async refreshTokens(): Promise<void> {
    if (!this.tokens) throw new Error('No refresh token available');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
      redirect_uri: this.redirectUri,
    });

    const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    this.logger.log('Yahoo tokens refreshed');
  }

  isAuthenticated(): boolean {
    return this.tokens !== null;
  }
}
