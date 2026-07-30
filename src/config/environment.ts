type Environment = Record<string, unknown>;

function getString(environment: Environment, name: string): string | undefined {
  const value = environment[name];

  return typeof value === 'string' ? value.trim() : undefined;
}

function requireValue(environment: Environment, name: string): string {
  const value = getString(environment, name);

  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }

  return value;
}

function requireSecret(environment: Environment, name: string): string {
  const value = requireValue(environment, name);

  if (value.length < 32) {
    throw new Error(`${name} 환경변수는 32자 이상이어야 합니다.`);
  }

  return value;
}

function parsePositiveInteger(
  environment: Environment,
  name: string,
  defaultValue: number,
): number {
  const value = Number(getString(environment, name) ?? defaultValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 환경변수는 양의 정수여야 합니다.`);
  }

  return value;
}

export function validateEnvironment(environment: Environment): Environment {
  const smtpSecure = getString(environment, 'SMTP_SECURE') ?? 'true';
  const accessSecret = requireSecret(environment, 'JWT_ACCESS_SECRET');
  const refreshSecret = requireSecret(environment, 'JWT_REFRESH_SECRET');

  if (smtpSecure !== 'true' && smtpSecure !== 'false') {
    throw new Error('SMTP_SECURE 환경변수는 true 또는 false여야 합니다.');
  }

  if (accessSecret === refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET과 JWT_REFRESH_SECRET은 서로 달라야 합니다.',
    );
  }

  return {
    ...environment,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL_SECONDS: parsePositiveInteger(
      environment,
      'JWT_ACCESS_TTL_SECONDS',
      900,
    ),
    JWT_REFRESH_TTL_SECONDS: parsePositiveInteger(
      environment,
      'JWT_REFRESH_TTL_SECONDS',
      1_209_600,
    ),
    SMTP_HOST: getString(environment, 'SMTP_HOST') || 'mail.spacemail.com',
    SMTP_PORT: parsePositiveInteger(environment, 'SMTP_PORT', 465),
    SMTP_SECURE: smtpSecure === 'true',
    SMTP_USER: requireValue(environment, 'SMTP_USER'),
    SMTP_PASSWORD: requireValue(environment, 'SMTP_PASSWORD'),
    SMTP_FROM_EMAIL: getString(environment, 'SMTP_FROM_EMAIL') || 'me@suk.kr',
    SMTP_FROM_NAME: getString(environment, 'SMTP_FROM_NAME') || 'Todo',
  };
}
