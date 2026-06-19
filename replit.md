# ISO Gestão IA

Plataforma SaaS para empresas brasileiras conquistarem certificações ISO usando IA — diagnóstico, geração de documentos, consultoria por chat e acompanhamento de conformidade.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/iso-saas run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `OPENROUTER_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS 4 + shadcn/ui + TanStack Query v5
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (15min access token, 7d refresh token via `SESSION_SECRET`)
- AI: OpenRouter (primary: `openai/gpt-4o-mini`, fallbacks: `deepseek/deepseek-r1`, `meta-llama/llama-3.3-70b-instruct`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle DB schema (users, companies, standards, diagnostics, documents, chat, audit, jobs)
- `lib/api-client-react/src/generated/` — generated React Query hooks (re-exported from `@workspace/api-client-react`)
- `lib/api-zod/src/generated/` — generated Zod schemas for backend validation
- `artifacts/api-server/src/routes/` — Express route handlers (auth, companies, standards, diagnostics, documents, chat, dashboard, audit)
- `artifacts/iso-saas/src/` — React frontend (pages, components, lib)

## Architecture decisions

- **Contract-first**: OpenAPI spec drives both frontend hooks (Orval → TanStack Query) and backend Zod validation. Never hand-write API types.
- **Multi-tenant by company**: Every resource scoped to `companyId`; users belong to one company.
- **JWT stateless auth**: No sessions table. Access token in `localStorage` under key `iso_access_token`. `setAuthTokenGetter` wires the token into all generated API calls.
- **OpenRouter with fallback**: AI calls try models in order; if one fails, the next is attempted automatically.
- **Audit log on all mutations**: The `recordAudit()` helper in `lib/audit.ts` is called in every route that modifies data.

## Product

- **Login / Registro**: JWT auth, empresa criada no registro
- **Dashboard**: visão geral de conformidade, documentos e atividade recente
- **Normas (passo 1)**: escolha das certificações ISO desejadas (ISO 9001, 14001, 45001, 22000, 27001, 13485)
- **Diagnóstico (passo 2)**: geração de diagnóstico IA com base na empresa e normas selecionadas
- **Documentos (passo 3)**: geração automática de todos os documentos necessários, visualização e edição
- **Chat IA**: consultor especialista em normas ISO disponível 24/7
- **Auditoria**: log completo de todas as ações na plataforma
- **Configurações**: perfil e dados da empresa

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `bcrypt` native build requires `onlyBuiltDependencies: [bcrypt]` in `pnpm-workspace.yaml` — already configured.
- Generated hooks from Orval take `(params, { query: { queryKey, enabled, ... } })` — `queryKey` is **required** in the options object. Use the matching `get*QueryKey(params)` helper.
- `useGetCompanyStandards` takes `(id: string, options)` not `(params, options)` — different from list hooks.
- DB arrays use `.array()` method on column type (e.g. `text("benefits").array()`).
- Do NOT import from `@workspace/api-client-react/src/generated/api` directly — everything is re-exported from the package root.
- Standards are seeded once via `executeSql` in the agent code execution sandbox — 6 normas ISO pre-loaded.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
