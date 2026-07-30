# Todo API

이메일 인증과 access/refresh token 세션을 사용하는 수업용 NestJS Todo API입니다.
Todo, 이메일 인증 코드, 로그인 세션은 모두 로컬 인메모리 캐시에 저장되므로
서버를 재시작하면 사라집니다.

## 환경변수

`.env.example`을 참고해 `.env`를 작성합니다.

```dotenv
PORT=5000

JWT_ACCESS_SECRET=32자 이상의 임의 문자열
JWT_REFRESH_SECRET=access와 다른 32자 이상의 임의 문자열
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=1209600

SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=me@suk.kr
SMTP_PASSWORD=메일 계정 비밀번호
SMTP_FROM_EMAIL=me@suk.kr
SMTP_FROM_NAME=Todo
```

`JWT_ACCESS_SECRET`과 `JWT_REFRESH_SECRET`은 반드시 서로 다른 값을 사용합니다.
SpaceMail SSL 설정은 포트 `465`, `SMTP_SECURE=true`입니다.

## 실행

```bash
pnpm install
pnpm run start:dev
```

Swagger UI는 `http://localhost:5000/api-docs`에서 확인할 수 있습니다.

## 로그인 흐름

1. `POST /auth/email/send-code`에 이메일을 보내 인증 코드를 요청합니다.
2. 이메일로 받은 6자리 코드를 `POST /auth/email/verify`에 보냅니다.
3. 응답의 `accessToken`을 Todo API의 `Authorization: Bearer <token>` 헤더에 사용합니다.
4. access token 만료 시 `POST /auth/refresh`로 두 토큰을 모두 갱신합니다.
5. 갱신에 사용한 기존 refresh token은 즉시 무효화됩니다.
6. `POST /auth/logout`에 refresh token을 보내 서버 세션을 삭제합니다.

인증 코드는 10분간 유효하고 최대 5회까지 입력할 수 있으며, 재전송은 60초마다
가능합니다. access token은 기본 15분, refresh token과 세션은 기본 14일간
유효합니다.

## API

| Method | Path                    | 인증                | 설명                      |
| ------ | ----------------------- | ------------------- | ------------------------- |
| POST   | `/auth/email/send-code` | 없음                | 이메일 인증 코드 전송     |
| POST   | `/auth/email/verify`    | 없음                | 이메일 인증 및 로그인     |
| POST   | `/auth/refresh`         | 없음                | access/refresh token 회전 |
| POST   | `/auth/logout`          | refresh token body  | 서버 세션 삭제            |
| GET    | `/auth/me`              | Bearer access token | 현재 이메일 ID 조회       |
| GET    | `/todos`                | Bearer access token | 전체 todo 조회            |
| GET    | `/todo/:todoId`         | Bearer access token | 단일 todo 조회            |
| POST   | `/todo`                 | Bearer access token | todo 생성 또는 덮어쓰기   |
| DELETE | `/todo/:todoId`         | Bearer access token | todo 삭제                 |

로그인 ID는 인증된 이메일 주소입니다. Todo 목록은 이메일별로 분리하지 않고 모든
로그인 사용자가 같은 목록을 공유합니다.

## WebSocket

WebSocket 주소는 `ws://localhost:5000/todos`이며, 운영 HTTPS 환경에서는
`wss://<도메인>/todos`를 사용합니다. access token이 없는 연결은 종료 코드
`1008`로 거절됩니다.

React Native에서는 헤더로 access token을 전달하는 방식을 권장합니다.

```ts
const socket = new WebSocket('wss://dy-backend.seogaemo.com/todos', undefined, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'todos.updated') {
    setTodos(message.todos);
  }
};
```

WebSocket 클라이언트가 헤더를 지원하지 않는 경우
`/todos?accessToken=<token>`도 사용할 수 있지만, URL이 프록시 로그에 남을 수
있으므로 헤더 방식을 우선합니다.
