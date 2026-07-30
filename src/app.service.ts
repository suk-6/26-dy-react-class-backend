import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { TodoDto } from './todo.dto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly todoIndexKey = 'todos:index';

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getTodos(): Promise<TodoDto[]> {
    const todoIds = await this.getTodoIds();
    const todos = await Promise.all(
      todoIds.map((todoId) =>
        this.cacheManager.get<TodoDto>(this.getTodoKey(todoId)),
      ),
    );

    return todos.filter((todo): todo is TodoDto => todo !== undefined);
  }

  async getTodo(todoId: string): Promise<TodoDto> {
    const todo = await this.cacheManager.get<TodoDto>(this.getTodoKey(todoId));

    if (!todo) {
      throw new NotFoundException(
        `id가 '${todoId}'인 todo를 찾을 수 없습니다.`,
      );
    }

    return todo;
  }

  async createTodo(todo: TodoDto, email: string): Promise<TodoDto> {
    const todoKey = this.getTodoKey(todo.id);
    const existingTodo = await this.cacheManager.get<TodoDto>(todoKey);

    await this.cacheManager.set(todoKey, todo, 0);
    await this.addTodoId(todo.id);

    if (!existingTodo) {
      this.logger.log(
        `새로운 todo가 저장되었습니다. email=${JSON.stringify(email)}, content=${JSON.stringify(todo.content)}`,
      );
    }

    return todo;
  }

  async deleteTodo(todoId: string): Promise<TodoDto> {
    const todo = await this.getTodo(todoId);
    const todoIds = await this.getTodoIds();

    await this.cacheManager.del(this.getTodoKey(todoId));
    await this.cacheManager.set(
      this.todoIndexKey,
      todoIds.filter((id) => id !== todoId),
      0,
    );

    return todo;
  }

  private async getTodoIds(): Promise<string[]> {
    return (await this.cacheManager.get<string[]>(this.todoIndexKey)) ?? [];
  }

  private async addTodoId(todoId: string): Promise<void> {
    const todoIds = await this.getTodoIds();

    if (todoIds.includes(todoId)) {
      return;
    }

    await this.cacheManager.set(this.todoIndexKey, [...todoIds, todoId], 0);
  }

  private getTodoKey(todoId: string): string {
    return `todo:${todoId}`;
  }
}
