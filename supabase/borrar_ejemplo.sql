-- Asesor Financiero · Borrar SOLO los datos de ejemplo
-- Quita lo que creó supabase/seed.sql y conserva lo que tú hayas cargado
-- (movimientos importados o capturados, metas propias, reglas aprendidas).
--
-- Cómo los distingue: el seed insertó todo en una sola operación, así que
-- todas sus filas comparten exactamente la misma fecha de creación.

do $$
declare
  v_marcas timestamptz[];
begin
  select array_agg(distinct created_at) into v_marcas
  from public.transactions
  where descripcion_original = 'RENT PAYMENT REALESTATE AU'
    and monto = 2200
    and es_recurrente
    and import_id is null;

  if v_marcas is null then
    raise exception 'No encontré datos de ejemplo: puede que ya estén borrados.';
  end if;

  -- Movimientos, metas (y sus aportaciones) y pagos programados de ejemplo
  delete from public.transactions where created_at = any (v_marcas);
  delete from public.savings_goals where created_at = any (v_marcas);
  delete from public.scheduled_payments where created_at = any (v_marcas);

  -- Cuentas de ejemplo: se borran si ya no tienen nada tuyo asociado…
  delete from public.accounts a
  where a.created_at = any (v_marcas)
    and not exists (select 1 from public.transactions t where t.account_id = a.id)
    and not exists (select 1 from public.scheduled_payments p where p.account_id = a.id);

  -- …y si alguna quedó porque la usaste, se le quitan el saldo y los dígitos
  -- inventados, salvo que ya los hayas cambiado por los tuyos.
  update public.accounts
  set saldo_actual = 0
  where created_at = any (v_marcas)
    and (nombre, saldo_actual) in (
      ('Cuenta de débito', 3450), ('Tarjeta de crédito', -1280), ('Ahorro', 9700), ('Efectivo', 120)
    );

  update public.accounts
  set ultimos4 = null
  where created_at = any (v_marcas) and ultimos4 in ('4821', '7730');

  -- Categorías: se conservan los nombres (son un buen punto de partida) y se
  -- pone en cero el presupuesto inventado, salvo que ya lo hayas cambiado.
  update public.categories
  set presupuesto_mensual = 0
  where created_at = any (v_marcas)
    and (nombre, presupuesto_mensual) in (
      ('Supermercado', 800), ('Restaurantes', 300), ('Transporte', 250), ('Vivienda', 2200),
      ('Servicios', 300), ('Entretenimiento', 150), ('Salud', 120), ('Compras', 250)
    );
end $$;

-- Resumen de lo que queda
select
  (select count(*) from public.transactions) as movimientos,
  (select count(*) from public.accounts) as cuentas,
  (select count(*) from public.categories) as categorias,
  (select count(*) from public.savings_goals) as metas,
  (select count(*) from public.scheduled_payments) as pagos_programados;
