import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthTokensDto,
  MeResponseDto,
  MessageResponseDto,
  RefreshTokenDto,
  SendEmailCodeDto,
  VerifyEmailDto,
} from './auth.dto';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/send-code')
  @HttpCode(200)
  @ApiOperation({
    summary: '이메일 인증 코드 전송',
    description:
      '입력한 이메일로 6자리 인증 코드를 전송합니다. 코드는 10분간 유효하며 60초마다 다시 요청할 수 있습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '인증 코드 전송 성공',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '올바르지 않은 이메일 형식',
  })
  @ApiResponse({
    status: 429,
    description: '인증 코드 재전송 대기 시간',
  })
  @ApiResponse({
    status: 503,
    description: 'SMTP 이메일 전송 실패',
  })
  async sendEmailCode(
    @Body() body: SendEmailCodeDto,
  ): Promise<MessageResponseDto> {
    await this.authService.sendEmailCode(body.email);

    return { message: '인증 코드를 이메일로 전송했습니다.' };
  }

  @Post('email/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: '이메일 인증 및 로그인',
    description:
      '이메일 인증 코드를 검증하고 새로운 로그인 세션의 access token과 refresh token을 발급합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '이메일 인증 및 로그인 성공',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: 400,
    description: '인증 코드 오류, 만료 또는 입력 횟수 초과',
  })
  verifyEmail(@Body() body: VerifyEmailDto): Promise<AuthTokensDto> {
    return this.authService.verifyEmail(body.email, body.code);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: '토큰 갱신',
    description:
      '유효한 refresh token을 검증하고 access token과 refresh token을 모두 새로 발급합니다. 기존 refresh token은 즉시 무효화됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 갱신 성공',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: 401,
    description: 'refresh token이 유효하지 않거나 만료됨',
  })
  refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: '로그아웃',
    description:
      'refresh token에 연결된 서버 세션을 삭제하여 해당 세션의 access/refresh token을 모두 무효화합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'refresh token이 유효하지 않음',
  })
  async logout(@Body() body: RefreshTokenDto): Promise<MessageResponseDto> {
    await this.authService.logout(body.refreshToken);

    return { message: '로그아웃되었습니다.' };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '현재 로그인 정보 조회',
    description: 'access token으로 인증된 사용자의 이메일 ID를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '현재 로그인 정보 조회 성공',
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'access token 또는 세션이 유효하지 않음',
  })
  getMe(@Req() request: AuthenticatedRequest): MeResponseDto {
    return { email: request.user.email };
  }
}
