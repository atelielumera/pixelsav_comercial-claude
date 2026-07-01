-- PixelSAV Comercial — schema Supabase
-- Execute no SQL Editor do Supabase (mesmo projeto do pixelsav-orcamento)

create extension if not exists pgcrypto;

-- Leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  whatsapp text unique not null,
  nome text,
  empresa text,
  cidade text,
  segmento text,
  perfil_cliente text,
  solucao_interesse text,
  valor_estimado text,
  agente_atual text default 'aurora',
  fase_kanban text default 'novo_lead',
  temperatura text default 'frio',
  status text default 'ativo',
  humano_no_controle boolean default false,
  humano_responsavel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Mensagens
create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  evolution_message_id text unique,
  autor text not null,
  tipo_autor text not null, -- aurora/lux/lumen/orion/sage/denise/emily/cliente
  conteudo text not null,
  timestamp timestamptz default now(),
  lido boolean default false
);

-- Briefings
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  gerado_por text,
  escopo text,
  valor_estimado text,
  sinal_positivo boolean default false,
  decisor text,
  urgencia text,
  objecoes text,
  created_at timestamptz default now()
);

-- Fila de prospecção (Lux outbound)
create table if not exists prospeccao_fila (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  toque_numero int default 1,
  mensagem_gerada text,
  status text default 'pendente', -- pendente/aprovado/enviado/pulado/arquivado
  aprovado_por text,
  created_at timestamptz default now(),
  enviado_at timestamptz
);

-- Blacklist
create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  whatsapp text unique,
  motivo text,
  criado_por text,
  created_at timestamptz default now()
);

-- Feriados
create table if not exists feriados (
  id uuid primary key default gen_random_uuid(),
  data date unique,
  descricao text,
  tipo text default 'nacional'
);

-- Configurações
create table if not exists configuracoes (
  chave text primary key,
  valor text
);

insert into configuracoes (chave, valor) values
  ('horario_inicio', '09:00'),
  ('horario_fim', '18:00'),
  ('dias_uteis', 'seg,ter,qua,qui,sex')
on conflict (chave) do nothing;

create index if not exists idx_mensagens_lead_id on mensagens(lead_id);
create index if not exists idx_mensagens_evolution_id on mensagens(evolution_message_id);
create index if not exists idx_leads_whatsapp on leads(whatsapp);
create index if not exists idx_prospeccao_fila_lead_id on prospeccao_fila(lead_id);
