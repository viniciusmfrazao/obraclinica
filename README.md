# ObraClínica — Diário de obra

Sistema pessoal para registrar o andamento da construção da clínica:
atividades, pagamentos, documentos e fotos, com um painel de resumo.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth + Storage)

## 1. Configurar o banco de dados

No painel do Supabase do seu projeto, vá em **SQL Editor** e rode o conteúdo de
`supabase/migrations/0001_init.sql`. Isso cria as tabelas
(`activities`, `payments`, `documents`, `photos`), as políticas de segurança
(RLS) e os buckets de armazenamento (`photos`, `documents`).

## 2. Criar seu usuário de login

Como é uso pessoal, crie um único usuário em **Authentication → Users → Add user**
no painel do Supabase, com seu e-mail e senha. É esse login que você vai usar
no app.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados do seu projeto
Supabase (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

**Nunca** commite o `.env.local` — ele já está no `.gitignore`.

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 e entre com o e-mail/senha criados no passo 2.

## 5. Publicar (opcional)

Deploy recomendado: [Vercel](https://vercel.com). Basta importar este
repositório e configurar as mesmas variáveis de ambiente do passo 3 no
painel do projeto na Vercel.

## Estrutura

- `Atividades` — etapas da obra com status (planejado / em andamento / concluído)
- `Pagamentos` — valor, categoria, fornecedor e comprovante opcional
- `Documentos` — upload de contratos, notas fiscais, alvarás, projetos
- `Fotos` — registro visual do progresso, vinculável a uma atividade
- `Painel` — totais, gastos por categoria e linha do tempo dos últimos registros

Todos os módulos podem ser vinculados a uma atividade específica (opcional).
