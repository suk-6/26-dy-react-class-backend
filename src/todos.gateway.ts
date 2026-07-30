import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { TodoDto } from './todo.dto';

@WebSocketGateway({
  path: '/todos',
})
export class TodosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TodosGateway.name);
  private readonly authenticatedClients = new Set<WebSocket>();

  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(
    client: WebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    try {
      await this.authService.authenticateAccessToken(
        this.getAccessToken(request),
      );
    } catch {
      client.close(1008, '인증이 필요합니다.');
      return;
    }

    this.authenticatedClients.add(client);
    this.logger.log(
      `WebSocket 클라이언트가 연결되었습니다. ip=${this.getClientIp(request)}`,
    );
    this.send(client, await this.appService.getTodos());
  }

  handleDisconnect(client: WebSocket): void {
    this.authenticatedClients.delete(client);
  }

  notifyTodosUpdated(todos: TodoDto[]): void {
    this.authenticatedClients.forEach((client) => this.send(client, todos));
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

  private getAccessToken(request: IncomingMessage): string | undefined {
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim();
    }

    const url = new URL(request.url ?? '/', 'ws://localhost');

    return url.searchParams.get('accessToken') ?? undefined;
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
