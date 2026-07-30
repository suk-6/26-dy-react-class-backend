import type { Request } from 'express';

export type TokenType = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  type: TokenType;
  iat?: number;
  exp?: number;
}

export interface AuthSession {
  id: string;
  email: string;
  refreshTokenHash: string;
  expiresAt: number;
}

export interface EmailVerification {
  codeHash: string;
  attempts: number;
  expiresAt: number;
}

export interface AuthenticatedUser {
  email: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
