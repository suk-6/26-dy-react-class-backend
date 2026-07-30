import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { AuthTokensDto } from './auth.dto';
import {
  AuthSession,
  AuthenticatedUser,
  AuthTokenPayload,
  EmailVerification,
} from './auth.types';
import { MailService } from './mail.service';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {
    this.accessTokenTtlSeconds = this.configService.getOrThrow<number>(
      'JWT_ACCESS_TTL_SECONDS',
    );
    this.refreshTokenTtlSeconds = this.configService.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );
  }

  async sendEmailCode(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const cooldownKey = this.getEmailCooldownKey(email);
    const isCoolingDown = await this.cacheManager.get<boolean>(cooldownKey);

    if (isCoolingDown) {
      throw new HttpException(
        '인증 코드는 60초 후 다시 요청할 수 있습니다.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(100_000, 1_000_000));
    const verification: EmailVerification = {
      codeHash: this.hash(code),
      attempts: 0,
      expiresAt: Date.now() + EMAIL_CODE_TTL_MS,
    };
    const verificationKey = this.getEmailVerificationKey(email);

    await this.cacheManager.set(
      verificationKey,
      verification,
      EMAIL_CODE_TTL_MS,
    );
    await this.cacheManager.set(cooldownKey, true, EMAIL_CODE_COOLDOWN_MS);

    try {
      await this.mailService.sendVerificationCode(email, code);
    } catch (error) {
      await Promise.all([
        this.cacheManager.del(verificationKey),
        this.cacheManager.del(cooldownKey),
      ]);
      throw error;
    }
  }

  async verifyEmail(rawEmail: string, code: string): Promise<AuthTokensDto> {
    const email = this.normalizeEmail(rawEmail);
    const verificationKey = this.getEmailVerificationKey(email);
    const verification =
      await this.cacheManager.get<EmailVerification>(verificationKey);

    if (!verification || verification.expiresAt <= Date.now()) {
      await this.cacheManager.del(verificationKey);
      throw new BadRequestException(
        '인증 코드가 만료되었거나 존재하지 않습니다.',
      );
    }

    if (!this.hashesMatch(verification.codeHash, this.hash(code))) {
      verification.attempts += 1;

      if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await this.cacheManager.del(verificationKey);
        throw new BadRequestException(
          '인증 코드 입력 횟수를 초과했습니다. 새 코드를 요청해 주세요.',
        );
      }

      await this.cacheManager.set(
        verificationKey,
        verification,
        verification.expiresAt - Date.now(),
      );
      throw new BadRequestException('인증 코드가 올바르지 않습니다.');
    }

    await this.cacheManager.del(verificationKey);

    return this.createSession(email);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyToken(
      refreshToken,
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      'refresh',
    );
    const session = await this.getSession(payload.sid);

    if (
      !session ||
      session.email !== payload.sub ||
      !this.hashesMatch(session.refreshTokenHash, this.hash(refreshToken))
    ) {
      throw new UnauthorizedException(
        'refresh token이 유효하지 않거나 이미 사용되었습니다.',
      );
    }

    return this.issueTokens(session.email, session.id);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyToken(
      refreshToken,
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      'refresh',
    );
    const session = await this.getSession(payload.sid);

    if (
      !session ||
      session.email !== payload.sub ||
      !this.hashesMatch(session.refreshTokenHash, this.hash(refreshToken))
    ) {
      throw new UnauthorizedException('refresh token이 유효하지 않습니다.');
    }

    await this.cacheManager.del(this.getSessionKey(session.id));
  }

  async authenticateAccessToken(
    accessToken: string | undefined,
  ): Promise<AuthenticatedUser> {
    if (!accessToken) {
      throw new UnauthorizedException('access token이 필요합니다.');
    }

    const payload = await this.verifyToken(
      accessToken,
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      'access',
    );
    const session = await this.getSession(payload.sid);

    if (!session || session.email !== payload.sub) {
      throw new UnauthorizedException(
        '로그인 세션이 만료되었거나 존재하지 않습니다.',
      );
    }

    return {
      email: session.email,
      sessionId: session.id,
    };
  }

  private async createSession(email: string): Promise<AuthTokensDto> {
    return this.issueTokens(email, randomUUID());
  }

  private async issueTokens(
    email: string,
    sessionId: string,
  ): Promise<AuthTokensDto> {
    const accessPayload: AuthTokenPayload = {
      sub: email,
      sid: sessionId,
      jti: randomUUID(),
      type: 'access',
    };
    const refreshPayload: AuthTokenPayload = {
      sub: email,
      sid: sessionId,
      jti: randomUUID(),
      type: 'refresh',
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTokenTtlSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTokenTtlSeconds,
      }),
    ]);
    const session: AuthSession = {
      id: sessionId,
      email,
      refreshTokenHash: this.hash(refreshToken),
      expiresAt: Date.now() + this.refreshTokenTtlSeconds * 1000,
    };

    await this.cacheManager.set(
      this.getSessionKey(sessionId),
      session,
      this.refreshTokenTtlSeconds * 1000,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn: this.accessTokenTtlSeconds,
      refreshTokenExpiresIn: this.refreshTokenTtlSeconds,
    };
  }

  private async verifyToken(
    token: string,
    secret: string,
    expectedType: AuthTokenPayload['type'],
  ): Promise<AuthTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        { secret },
      );

      if (
        payload.type !== expectedType ||
        !payload.sub ||
        !payload.sid ||
        !payload.jti
      ) {
        throw new Error('Invalid token payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        `${expectedType} token이 유효하지 않거나 만료되었습니다.`,
      );
    }
  }

  private async getSession(
    sessionId: string,
  ): Promise<AuthSession | undefined> {
    const session = await this.cacheManager.get<AuthSession>(
      this.getSessionKey(sessionId),
    );

    if (session && session.expiresAt <= Date.now()) {
      await this.cacheManager.del(this.getSessionKey(sessionId));
      return undefined;
    }

    return session;
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private hash(value: string): string {
    return createHmac(
      'sha256',
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    )
      .update(value)
      .digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getEmailVerificationKey(email: string): string {
    return `auth:email-verification:${email}`;
  }

  private getEmailCooldownKey(email: string): string {
    return `auth:email-cooldown:${email}`;
  }

  private getSessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }
}
