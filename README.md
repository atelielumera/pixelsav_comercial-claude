# PixelSAV Comercial

Sistema de atendimento comercial via WhatsApp com 5 agentes de IA (Aurora, Lux, Lumen, Orion, Sage) e 2 usuários humanos (Denise e Emily), integrado com Evolution API, Supabase e Claude API.

## Stack

- Next.js (Pages Router)
- Supabase (Postgres + service key server-side)
- Claude API (`claude-sonnet-4-6`)
- Evolution API (instância `PIXELSAV`)
- Deploy: Vercel

## Setup

1. Instale as dependências:
   ```
   npm install
   ```
2. Copie `.env.local.example` para `.env.local` e preencha as credenciais:
   ```
   SUPABASE_URL=
   SUPABASE_SERVICE_KEY=
   ANTHROPIC_API_KEY=
   EVOLUTION_API_URL=
   EVOLUTION_API_KEY=
   EVOLUTION_INSTANCE=PIXELSAV
   ```
3. Execute `supabase/schema.sql` no SQL Editor do projeto Supabase (mesmo projeto do pixelsav-orcamento) para criar as tabelas `leads`, `mensagens`, `briefings`, `prospeccao_fila`, `blacklist`, `feriados` e `configuracoes`.
4. Rode localmente:
   ```
   npm run dev
   ```
5. Deploy:
   ```
   vercel --prod
   ```

## Arquitetura dos agentes

| Agente | Papel |
|--------|-------|
| Aurora | SDR — recebe e qualifica leads novos |
| Lux | Hunter — aprofunda qualificação, discute valores, detecta sinal positivo |
| Lumen | Farmer — retém e reativa clientes antigos (status `won`) |
| Orion | Closer — follow-up, propostas, fechamento |
| Sage | Copiloto — orienta Denise e Emily via painel, não fala com o cliente |

O roteamento entre agentes acontece em `pages/api/webhook.js`, que recebe os eventos da Evolution API e delega a geração de resposta para `pages/api/agentes/{aurora,lux,lumen,orion,sage}.js`.

Todas as queries ao Supabase usam a `SERVICE_KEY` em rotas server-side (`lib/supabaseAdmin.js`) — nunca a `anon key` no client-side.

## Regras importantes

- Aurora nunca dá preços — isso é exclusividade do Lux.
- Quando `humano_no_controle = true` no lead, nenhum agente responde automaticamente.
- Deduplicação de mensagens do WhatsApp é feita via coluna `evolution_message_id` no Supabase (não em memória — o ambiente é serverless).
- O webhook só responde `200` depois que todo o processamento (resposta do agente, envio via Evolution, gravação no banco) termina.
