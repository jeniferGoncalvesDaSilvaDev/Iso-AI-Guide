# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY scripts/ ./scripts/

RUN pnpm install --frozen-lockfile
RUN cd artifacts/api-server && pnpm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy only production deps + build output
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/api-server/dist/ ./artifacts/api-server/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
