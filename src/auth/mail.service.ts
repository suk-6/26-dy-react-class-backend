import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: {
    address: string;
    name: string;
  };

  constructor(private readonly configService: ConfigService) {
    const port = this.configService.getOrThrow<number>('SMTP_PORT');
    const secure = this.configService.getOrThrow<boolean>('SMTP_SECURE');

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port,
      secure,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });
    this.from = {
      address: this.configService.getOrThrow<string>('SMTP_FROM_EMAIL'),
      name: this.configService.getOrThrow<string>('SMTP_FROM_NAME'),
    };
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: '[Todo] 이메일 인증 코드',
        text: `Todo 로그인 인증 코드는 ${code}입니다. 인증 코드는 10분 동안 유효합니다.`,
        html: [
          '<div style="font-family: sans-serif; line-height: 1.6">',
          '<h2>Todo 이메일 인증</h2>',
          '<p>아래 인증 코드를 Todo 앱에 입력해 주세요.</p>',
          `<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px">${code}</p>`,
          '<p>인증 코드는 10분 동안 유효합니다.</p>',
          '</div>',
        ].join(''),
      });
    } catch {
      throw new ServiceUnavailableException(
        '인증 이메일을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }
}
