import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import { Server, WebSocket } from 'ws';
import { AppService } from './app.service';
import { TodoDto } from './todo.dto';

@WebSocketGateway({
  path: '/todos',
})
export class TodosGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TodosGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly appService: AppService) {}

  async handleConnection(
    client: WebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    this.logger.log(
      `WebSocket 클라이언트가 연결되었습니다. ip=${this.getClientIp(request)}`,
    );
    this.send(client, await this.appService.getTodos());
  }

  notifyTodosUpdated(todos: TodoDto[]): void {
    this.server.clients.forEach((client) => this.send(client, todos));
  }

  private send(client: WebSocket, todos: TodoDto[]): void {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }

    client.send(
      JSON.stringify({
        type: 'todos.updated',
        message: 'todo 목록이 업데이트되었습니다.',
        todos,
      }),
    );
  }

  private getClientIp(request: IncomingMessage): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0] ?? 'unknown';
    }

    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];

    if (Array.isArray(realIp)) {
      return realIp[0] ?? 'unknown';
    }

    return realIp ?? request.socket.remoteAddress ?? 'unknown';
  }
}
