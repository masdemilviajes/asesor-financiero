-- Asesor Financiero · 0004 · Transferencias y pagos semanales
-- 1) Nuevo tipo de movimiento "transferencia": traspasos entre cuentas propias
--    y conversiones de moneda. No cuentan como gasto ni como ingreso.
-- 2) Las reglas aprendidas también pueden decir "esto es una transferencia".
-- 3) Los pagos programados admiten frecuencia semanal y quincenal.
-- Se puede ejecutar más de una vez sin problema.

alter table public.transactions drop constraint if exists transactions_tipo_check;
alter table public.transactions
  add constraint transactions_tipo_check check (tipo in ('gasto', 'ingreso', 'transferencia'));

alter table public.categorization_rules
  add column if not exists es_transferencia boolean not null default false;
alter table public.categorization_rules alter column category_id drop not null;
alter table public.categorization_rules drop constraint if exists categorization_rules_destino_check;
alter table public.categorization_rules
  add constraint categorization_rules_destino_check
  check (es_transferencia or category_id is not null);

alter table public.scheduled_payments drop constraint if exists scheduled_payments_frecuencia_check;
alter table public.scheduled_payments
  add constraint scheduled_payments_frecuencia_check
  check (frecuencia in ('semanal', 'quincenal', 'mensual', 'anual', 'unica'));
