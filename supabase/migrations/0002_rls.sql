-- Asesor Financiero · 0002 · Row Level Security
-- Cada usuario solo puede ver y modificar las filas donde user_id es el suyo.

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts',
    'categories',
    'imports',
    'transactions',
    'categorization_rules',
    'savings_goals',
    'savings_contributions',
    'scheduled_payments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', t
    );
    execute format(
      'create policy "solo_mis_filas" on public.%I
         for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;
