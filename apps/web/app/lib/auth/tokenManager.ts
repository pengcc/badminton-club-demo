/**
 * TokenManager - SSR-safe token storage abstraction
 *
 * Provides centralized token management with cookies and localStorage,
 * JWT decoding, and expiration checking.
 */

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

export class TokenManager {
  private static readonly TOKEN_KEY = 'token';
  private static readonly REFRESH_KEY = 'refresh_token';

  /**
   * Store authentication tokens in both cookies (for middleware) and localStorage (for client)
   * @param token - Access token (JWT)
   * @param refreshToken - Optional refresh token
   */
  static setToken(token: string, refreshToken?: string): void {
    if (typeof window === 'undefined') return;

    // Store in localStorage for client-side access
    localStorage.setItem(this.TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_KEY, refreshToken);
    }

    // Store in cookies for middleware access
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    document.cookie = `${this.TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (refreshToken) {
      document.cookie = `${this.REFRESH_KEY}=${refreshToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }

  /**
   * Retrieve access token from localStorage
   * @returns Token string or null if not found/SSR
   */
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Retrieve refresh token from localStorage
   * @returns Refresh token string or null if not found/SSR
   */
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_KEY);
  }

  /**
   * Clear all authentication tokens from both localStorage and cookies
   */
  static clearToken(): void {
    if (typeof window === 'undefined') return;

    // Clear localStorage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);

    // Clear cookies by setting max-age=0
    document.cookie = `${this.TOKEN_KEY}=; path=/; max-age=0`;
    document.cookie = `${this.REFRESH_KEY}=; path=/; max-age=0`;
  }

  /**
   * Check if token is expired
   * @param token - JWT token to check
   * @returns true if expired or invalid, false otherwise
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = this.getTokenPayload(token);
      if (!payload || !payload.exp) return true;

      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Decode JWT token payload
   * @param token - JWT token to decode
   * @returns Decoded payload or null if invalid
   */
  static getTokenPayload(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload as JWTPayload;
    } catch {
      return null;
    }
  }
}
