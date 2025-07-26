import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';

interface TokenPayload {
  id: string;
  role: 'ADMIN' | 'STAFF';
  email: string;
  username: string;
}

interface TokenResponse {
  refreshToken: string;
  expiresIn: number;
}

class TokenService {
  private readonly REFRESH_TOKEN_SECRET: string;
  private readonly REFRESH_TOKEN_EXPIRY: string;

  constructor() {
    this.REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
    this.REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Generate access and refresh tokens for a user
   * @param payload - User data to encode in tokens
   * @returns Object containing access token, refresh token, and expiry
   */
  generateToken(payload: TokenPayload): TokenResponse {
    const refreshToken = jwt.sign(
      payload, 
      this.REFRESH_TOKEN_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY } as SignOptions
    );

    return {
      refreshToken,
      expiresIn: 1 * 60 * 60 * 1000,
    };
  }

  /**
   * Verify refresh token
   * @param token - Refresh token to verify
   * @returns Decoded token payload
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Set authentication cookies
   * @param res - Express response object
   * @param tokens - Token response object
   */
  setAuthCookies(res: Response, tokens: TokenResponse): void {
    // Set refresh token as httpOnly cookie
    res.cookie('token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  /**
   * Clear authentication cookies
   * @param res - Express response object
   */
  clearAuthCookies(res: Response): void {
    res.clearCookie('refreshToken', { path: '/' });
  }

  /**
   * Extract token from cookies or headers
   * @param req - Express request object
   * @returns Token string or null
   */
  extractToken(req: Request): string | null {
    // First check cookies
    const cookieToken = req.cookies?.refreshToken;
    if (cookieToken) return cookieToken;

    // Fallback to Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}

export default new TokenService(); 