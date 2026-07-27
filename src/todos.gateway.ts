import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { AppService } from './app.service';
import { TodoDto } from './todo.dto';

@WebSocketGateway({
  path: '/todos',
})
export class TodosGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly appService: AppService) {}

  async handleConnection(client: WebSocket): Promise<void> {
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
}
