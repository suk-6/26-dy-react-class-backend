FROM ghcr.io/pnpm/pnpm:11.5.0 AS builder
RUN pnpm runtime set node 24.15.0 -g

ENV CI=true
ENV PATH="/pnpm:$PATH"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store

WORKDIR /app

COPY . /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm run build

FROM ghcr.io/pnpm/pnpm:11.5.0 AS runner
RUN pnpm runtime set node 24.15.0 -g

ENV CI=true
ENV TZ=Asia/Seoul
ENV PATH="/pnpm:$PATH"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store

WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

CMD ["pnpm", "start:prod"]