import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class TodoDto {
  @ApiProperty({
    description: 'todo 고유 ID',
    example: 'todo-1',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'todo 제목',
    example: 'NestJS 수업 듣기',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'todo 상세 내용',
    example: 'CacheModule과 Swagger 사용법 익히기',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'todo 날짜, ISO String 형식',
    example: '2026-05-30T09:00:00.000Z',
  })
  @IsDateString()
  date: string;
}
