import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendEmailCodeDto {
  @ApiProperty({
    description: '인증 코드를 받을 이메일 주소',
    example: 'student@example.com',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이어야 합니다.' })
  @MaxLength(254, { message: '이메일은 254자 이하여야 합니다.' })
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: '인증할 이메일 주소',
    example: 'student@example.com',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이어야 합니다.' })
  @MaxLength(254, { message: '이메일은 254자 이하여야 합니다.' })
  email: string;

  @ApiProperty({
    description: '이메일로 받은 6자리 인증 코드',
    example: '123456',
  })
  @IsString({ message: '인증 코드는 문자열이어야 합니다.' })
  @Matches(/^\d{6}$/, { message: '인증 코드는 6자리 숫자여야 합니다.' })
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: '로그인 또는 토큰 갱신 시 발급받은 refresh token',
  })
  @IsString({ message: 'refresh token은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: 'refresh token은 필수입니다.' })
  refreshToken: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: '처리 결과 메시지',
    example: '인증 코드를 이메일로 전송했습니다.',
  })
  message: string;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'API 인증에 사용하는 access token' })
  accessToken: string;

  @ApiProperty({ description: 'access token 재발급에 사용하는 refresh token' })
  refreshToken: string;

  @ApiProperty({ description: '토큰 인증 방식', example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'access token 유효 시간(초)', example: 900 })
  accessTokenExpiresIn: number;

  @ApiProperty({
    description: 'refresh token 및 세션 유효 시간(초)',
    example: 1209600,
  })
  refreshTokenExpiresIn: number;
}

export class MeResponseDto {
  @ApiProperty({
    description: '인증된 사용자의 이메일 ID',
    example: 'student@example.com',
  })
  email: string;
}
