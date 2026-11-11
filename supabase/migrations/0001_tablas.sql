-- Asesor Financiero · 0001 · Tablas
-- Todas las tablas llevan user_id (dueño de la fila). Se llena solo con el
-- usuario que tiene la sesión iniciada.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('debito', 'credito', 'efectivo', 'ahorro')),
  dia_corte smallint check (dia_corte between 1 and 31),
  dia_limite_pago smallint check (dia_limite_pago between 1 and 31),
  saldo_actual numeric(14, 2) not null default 0,
  -- Nunca el número completo: solo los últimos 4 dígitos.
  ultimos4 text check (ultimos4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  presupuesto_mensual numeric(14, 2) not null default 0 check (presupuesto_mensual >= 0),
  color_neutro text not null default '#737373',
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'listo', 'confirmado', 'error')),
  movimientos_detectados integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  fecha date not null,
  descripcion_original text not null,
  comercio text,
  -- Siempre positivo; el campo tipo dice si es gasto o ingreso.
  monto numeric(14, 2) not null check (monto >= 0),
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  category_id uuid references public.categories (id) on delete set null,
  requiere_revision boolean not null default false,
  es_recurrente boolean not null default false,
  -- Huella de fecha + monto + descripción para descartar duplicados.
  hash_unico text not null,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, hash_unico)
);

create index transactions_user_fecha_idx on public.transactions (user_id, fecha desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index transactions_revision_idx on public.transactions (user_id) where requiere_revision;

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Texto en minúsculas que, si aparece en la descripción, asigna la categoría.
  patron_texto text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, patron_texto)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14, 2) not null check (monto_objetivo > 0),
  monto_actual numeric(14, 2) not null default 0,
  fecha_objetivo date not null,
  created_at timestamptz not null default now()
);

-- Aportaciones a cada meta. Hacen falta para calcular el ritmo de ahorro de
-- los últimos 3 meses.
create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  fecha date not null default current_date,
  monto numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create index savings_contributions_goal_idx on public.savings_contributions (goal_id, fecha desc);

create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto numeric(14, 2) not null check (monto >= 0),
  frecuencia text not null check (frecuencia in ('mensual', 'anual', 'unica')),
  proximo_vencimiento date not null,
  account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index scheduled_payments_vencimiento_idx
  on public.scheduled_payments (user_id, proximo_vencimiento);
