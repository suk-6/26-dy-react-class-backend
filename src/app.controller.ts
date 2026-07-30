import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { AccessTokenGuard } from './auth/access-token.guard';
import { TodoDto } from './todo.dto';
import { TodosGateway } from './todos.gateway';

@ApiTags('Todo')
@ApiBearerAuth('access-token')
@ApiResponse({
  status: 401,
  description: 'access token 또는 로그인 세션이 유효하지 않음',
})
@UseGuards(AccessTokenGuard)
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly todosGateway: TodosGateway,
  ) {}

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
  async createTodo(@Body() todo: TodoDto): Promise<TodoDto> {
    const createdTodo = await this.appService.createTodo(todo);

    this.todosGateway.notifyTodosUpdated(await this.appService.getTodos());

    return createdTodo;
  }

  @Delete('todo/:todoId')
  @ApiOperation({
    summary: 'todo 삭제',
    description:
      'todo ID를 이용해 저장된 todo를 삭제합니다. 삭제 후 WebSocket 구독자에게 todo 목록 변경을 알립니다.',
  })
  @ApiParam({
    name: 'todoId',
    description: '삭제할 todo 고유 ID',
    example: 'todo-1',
  })
  @ApiResponse({
    status: 200,
    description: 'todo 삭제 성공. 삭제된 todo를 반환합니다.',
    type: TodoDto,
  })
  @ApiResponse({
    status: 404,
    description: '요청한 todo ID에 해당하는 todo를 찾을 수 없음',
  })
  async deleteTodo(@Param('todoId') todoId: string): Promise<TodoDto> {
    const deletedTodo = await this.appService.deleteTodo(todoId);

    this.todosGateway.notifyTodosUpdated(await this.appService.getTodos());

    return deletedTodo;
  }
}
