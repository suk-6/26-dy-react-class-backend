import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { TodoDto } from './todo.dto';

@Injectable()
export class AppService {
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

  async createTodo(todo: TodoDto): Promise<TodoDto> {
    await this.cacheManager.set(this.getTodoKey(todo.id), todo, 0);
    await this.addTodoId(todo.id);

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
