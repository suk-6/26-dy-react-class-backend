/// <reference types="jest" />

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';
import { AuthService } from './auth.service';
import type { MailService } from './mail.service';

describe('AuthService', () => {
  it('이메일 인증, 토큰 회전, 로그아웃까지 세션 생명주기를 처리한다', async () => {
    const values = new Map<string, unknown>();
    const cacheManager = {
      get: <T>(key: string): Promise<T | undefined> =>
        Promise.resolve(values.get(key) as T | undefined),
      set: (key: string, value: unknown): Promise<void> => {
        values.set(key, value);
        return Promise.resolve();
      },
      del: (key: string): Promise<boolean> =>
        Promise.resolve(values.delete(key)),
    } as unknown as Cache;
    const configService = new ConfigService({
      JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_TTL_SECONDS: 1_209_600,
    });
    let sentEmail = '';
    let sentCode = '';
    const mailService = {
      sendVerificationCode: jest.fn(
        (email: string, code: string): Promise<void> => {
          sentEmail = email;
          sentCode = code;
          return Promise.resolve();
        },
      ),
    } as unknown as MailService;
    const authService = new AuthService(
      cacheManager,
      configService,
      new JwtService(),
      mailService,
    );

    await authService.sendEmailCode(' Student@Example.com ');

    expect(sentEmail).toBe('student@example.com');
    expect(sentCode).toMatch(/^\d{6}$/);

    const firstTokens = await authService.verifyEmail(sentEmail, sentCode);
    const user = await authService.authenticateAccessToken(
      firstTokens.accessToken,
    );

    expect(user.email).toBe('student@example.com');

    const rotatedTokens = await authService.refresh(firstTokens.refreshToken);

    expect(rotatedTokens.accessToken).not.toBe(firstTokens.accessToken);
    expect(rotatedTokens.refreshToken).not.toBe(firstTokens.refreshToken);
    await expect(authService.refresh(firstTokens.refreshToken)).rejects.toThrow(
      '이미 사용되었습니다',
    );

    await authService.logout(rotatedTokens.refreshToken);
    await expect(
      authService.authenticateAccessToken(rotatedTokens.accessToken),
    ).rejects.toThrow('로그인 세션이 만료되었거나 존재하지 않습니다');
  });
});
