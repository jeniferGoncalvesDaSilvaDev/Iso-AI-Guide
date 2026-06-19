# Iso AI Guide 🤖📋

**Plataforma de Gestão ISO com Inteligência Artificial**

SaaS inteligente que ajuda empresas a implementar e certificar sistemas de gestão da qualidade ISO 9001:2015 utilizando IA generativa. Gera diagnósticos organizacionais, matriz documental completa e todos os documentos do SGQ com qualidade de consultoria profissional.

## 🚀 Funcionalidades

### 📊 Diagnóstico Inteligente
- Análise automática do contexto organizacional
- Mapeamento de partes interessadas
- Mapa de processos completo (gerenciais, fim, suporte)
- Matriz de riscos e oportunidades (probabilidade × impacto)
- Definição de KPIs e objetivos da qualidade
- Recomendações priorizadas por prazo

### 📋 Matriz Documental ISO 9001:2015
- 24 documentos obrigatórios do SGQ organizados por seção
- Códigos padronizados (SGQ, PQ, FQ, RQ, RT, RC)
- Geração individual ou em lote
- Status de cada documento (pendente, gerando, concluído, erro)
- Versionamento automático (00, 01, 02...)

### 🤖 Agentes Especializados
| Agente | Documentos |
|--------|-----------|
| **SGQAgent** | Escopo, Mapa de Processos, Política, Objetivos |
| **DocumentAgent** | Controle de Documentos, Lista Mestra |
| **AuditAgent** | Auditoria Interna, Análise Crítica |
| **NonConformityAgent** | Não Conformidade, Produto Não Conforme |
| **RiskAgent** | Rastreabilidade, Inspeção, Ordem de Produção |
| **TrainingAgent** | Treinamento, Competências, Presença |
| **CalibrationAgent** | Calibração de Equipamentos |

### 🔍 RAG (Retrieval-Augmented Generation)
- Indexação vetorial de documentos e diagnósticos
- Busca por similaridade semântica
- Chat consultor com contexto recuperado automaticamente

### 💬 Chat Consultor ISO
- Assistente especialista com 20+ anos de experiência
- Respostas baseadas nos documentos e diagnóstico da empresa
- Cita requisitos específicos da ISO 9001:2015

### 📤 Exportação
- HTML formatado para impressão/PDF
- Bundle completo do SGQ
- Matriz documental exportável

## 🏗️ Arquitetura

```
├── artifacts/
│   ├── api-server/          # Backend Express + TypeScript
│   │   └── src/
│   │       ├── generators/  # Motor de geração modular
│   │       │   ├── base.ts                  # Base context & utilities
│   │       │   ├── diagnostic-generator.ts  # Diagnóstico em 4 etapas
│   │       │   ├── document-generators.ts   # 24 geradores individuais
│   │       │   └── rag.ts                   # RAG com pgvector
│   │       └── routes/      # API REST
│   ├── iso-saas/            # Frontend React + Vite + shadcn/ui
│   └── mockup-sandbox/      # Preview de mockups
├── lib/
│   ├── api-client-react/    # Cliente API gerado (Orval + TanStack Query)
│   ├── api-spec/            # OpenAPI spec
│   ├── api-zod/             # Schemas Zod validados
│   └── db/                  # Banco de dados (Drizzle ORM + PostgreSQL)
│       └── src/schema/      # 12 tabelas
└── scripts/                 # Utilitários
```

### Fluxo de Geração

```
1. Empresa → Cadastro → Seleção de normas ISO
2. Diagnóstico IA → 4 chamadas independentes (contexto, processos, riscos, KPIs)
3. Matriz Documental → Criada automaticamente com 24 itens
4. Geração → Cada documento por agente especializado (chamada individual)
5. Indexação RAG → Embeddings para busca semântica
6. Chat Consultor → Responde com contexto recuperado
```

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|-----------|
| **Frontend** | React 19, Wouter, TanStack Query, shadcn/ui, Zod |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | PostgreSQL + Drizzle ORM + pgvector |
| **IA** | OpenRouter API (GPT-4o-mini, DeepSeek, Llama) |
| **SDK** | Orval (geração de API client) |
| **Package** | pnpm workspace monorepo |

## 📦 Pré-requisitos

- Node.js 20+
- pnpm
- PostgreSQL (com extensão pgvector)
- Conta no [OpenRouter.ai](https://openrouter.ai) (chave de API)

## 🔧 Configuração

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
export DATABASE_URL="postgres://user:pass@host:5432/iso-guide"
export OPENROUTER_API_KEY="sk-or-v1-..."
export PORT=3000

# 3. Push do schema do banco
cd lib/db && pnpm run push

# 4. Iniciar em desenvolvimento
cd artifacts/api-server && pnpm run dev     # Backend :3000
cd artifacts/iso-saas && pnpm run dev       # Frontend :5173
```

## 📄 Licença

MIT
