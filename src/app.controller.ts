import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { TodoDto } from './todo.dto';

@ApiTags('Todo')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('todos')
  @ApiOperation({
    summary: '전체 todo 목록 조회',
    description: '저장된 모든 todo를 배열 형태로 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '전체 todo 목록 조회 성공',
    type: TodoDto,
    isArray: true,
  })
  getTodos(): Promise<TodoDto[]> {
    return this.appService.getTodos();
  }

  @Get('todo/:todoId')
  @ApiOperation({
    summary: '단일 todo 조회',
    description: 'todo ID를 이용해 todo 하나를 조회합니다.',
  })
  @ApiParam({
    name: 'todoId',
    description: '조회할 todo 고유 ID',
    example: 'todo-1',
  })
  @ApiResponse({
    status: 200,
    description: '단일 todo 조회 성공',
    type: TodoDto,
  })
  @ApiResponse({
    status: 404,
    description: '요청한 todo ID에 해당하는 todo를 찾을 수 없음',
  })
  getTodo(@Param('todoId') todoId: string): Promise<TodoDto> {
    return this.appService.getTodo(todoId);
  }

  @Post('todo')
  @ApiOperation({
    summary: 'todo 생성 또는 덮어쓰기',
    description:
      'todo를 저장합니다. 같은 id가 이미 있으면 기존 todo를 덮어씁니다.',
  })
  @ApiBody({
    description: '저장할 todo 정보',
    type: TodoDto,
    examples: {
      normal: {
        summary: '정상 요청 예시',
        value: {
          id: 'todo-1',
          title: 'React 수업 듣기',
          content: 'React Hook 배우기',
          date: '2026-05-30T09:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'todo 저장 성공',
    type: TodoDto,
  })
  @ApiResponse({
    status: 400,
    description: '요청 body가 잘못됨',
  })
  createTodo(@Body() todo: TodoDto): Promise<TodoDto> {
    return this.appService.createTodo(todo);
  }
}
