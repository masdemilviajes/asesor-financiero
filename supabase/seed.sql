-- Asesor Financiero · Datos de ejemplo
-- Crea cuentas, categorías, ~6 meses de movimientos ficticios, metas y pagos
-- programados para el primer usuario que exista. Sirve para probar la app sin
-- datos reales. Para borrarlos después usa supabase/borrar_datos.sql.

do $$
declare
  v_user uuid;
  v_deb uuid;
  v_cred uuid;
  v_aho uuid;
  c_super uuid;
  c_rest uuid;
  c_trans uuid;
  c_viv uuid;
  c_serv uuid;
  c_ent uuid;
  c_salud uuid;
  c_compras uuid;
  g_fondo uuid;
  g_viaje uuid;
  v_mes date;
  v_hoy date := current_date;
  m int;
  i int;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'Primero crea tu usuario en Authentication > Users.';
  end if;
  if exists (select 1 from public.categories where user_id = v_user) then
    raise exception 'Ya hay datos cargados. Ejecuta supabase/borrar_datos.sql si quieres empezar de cero.';
  end if;

  perform setseed(0.42);

  -- Cuentas
  insert into public.accounts (user_id, nombre, tipo, saldo_actual, ultimos4)
  values (v_user, 'Cuenta de débito', 'debito', 3450.00, '4821')
  returning id into v_deb;

  insert into public.accounts (user_id, nombre, tipo, dia_corte, dia_limite_pago, saldo_actual, ultimos4)
  values (v_user, 'Tarjeta de crédito', 'credito', 20, 10, -1280.00, '7730')
  returning id into v_cred;

  insert into public.accounts (user_id, nombre, tipo, saldo_actual)
  values (v_user, 'Ahorro', 'ahorro', 9700.00)
  returning id into v_aho;

  insert into public.accounts (user_id, nombre, tipo, saldo_actual)
  values (v_user, 'Efectivo', 'efectivo', 120.00);

  -- Categorías con presupuesto mensual
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Supermercado', 800, '#171717') returning id into c_super;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Restaurantes', 300, '#404040') returning id into c_rest;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Transporte', 250, '#525252') returning id into c_trans;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Vivienda', 2200, '#737373') returning id into c_viv;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Servicios', 300, '#8a8a8a') returning id into c_serv;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Entretenimiento', 150, '#a3a3a3') returning id into c_ent;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Salud', 120, '#bdbdbd') returning id into c_salud;
  insert into public.categories (user_id, nombre, presupuesto_mensual, color_neutro)
  values (v_user, 'Compras', 250, '#d4d4d4') returning id into c_compras;

  -- Tabla temporal: aquí se arman los movimientos y al final se insertan con su hash.
  create temp table _seed_tx (
    account_id uuid,
    fecha date,
    descripcion text,
    comercio text,
    monto numeric(14, 2),
    tipo text,
    category_id uuid,
    recurrente boolean default false,
    revision boolean default false
  ) on commit drop;

  for m in 0..5 loop
    v_mes := (date_trunc('month', v_hoy) - make_interval(months => m))::date;

    -- Fijos de cada mes (recurrentes)
    insert into _seed_tx values
      (v_deb, v_mes, 'RENT PAYMENT REALESTATE AU', 'Renta', 2200.00, 'gasto', c_viv, true, false),
      (v_cred, v_mes + 2, 'ANYTIME FITNESS MEMBERSHIP', 'Gimnasio', 65.00, 'gasto', c_salud, true, false),
      (v_cred, v_mes + 4, 'NBN INTERNET DIRECT DEBIT', 'Internet', 79.00, 'gasto', c_serv, true, false),
      (v_cred, v_mes + 7, 'NETFLIX.COM SYDNEY', 'Netflix', 16.99, 'gasto', c_ent, true, false),
      (v_cred, v_mes + 8, 'SPOTIFY P1A2B3C4', 'Spotify', 13.99, 'gasto', c_ent, true, false),
      (v_deb, v_mes + 11, 'ENERGY AUSTRALIA BILL', 'Electricidad', round((105 + random() * 40)::numeric, 2), 'gasto', c_serv, false, false),
      (v_deb, v_mes + 17, 'MOBILE PLAN DIRECT DEBIT', 'Celular', 45.00, 'gasto', c_serv, true, false),
      (v_deb, v_mes + 14, 'SALARY ACME PTY LTD', 'Nómina', 2900.00, 'ingreso', null, true, false),
      (v_deb, v_mes + 27, 'SALARY ACME PTY LTD', 'Nómina', 2900.00, 'ingreso', null, true, false);

    -- Supermercado: 7 compras al mes
    for i in 0..6 loop
      insert into _seed_tx values (
        (array[v_deb, v_cred])[1 + (i % 2)],
        v_mes + (i * 4),
        (array['WOOLWORTHS 1294 SYDNEY', 'COLES 0871 NEWTOWN', 'ALDI STORES 45'])[1 + (i % 3)],
        (array['Woolworths', 'Coles', 'Aldi'])[1 + (i % 3)],
        round((85 + random() * 60)::numeric, 2), 'gasto', c_super, false, false
      );
    end loop;

    -- Restaurantes y café: 6 al mes
    for i in 0..5 loop
      insert into _seed_tx values (
        v_cred,
        v_mes + 1 + (i * 4),
        (array['SQ *CAMPOS COFFEE', 'UBER *EATS PENDING', 'THE LOCAL TAPHOUSE', 'MAMAK CHATSWOOD'])[1 + (i % 4)],
        (array['Campos Coffee', 'Uber Eats', 'The Local Taphouse', 'Mamak'])[1 + (i % 4)],
        round((18 + random() * 45)::numeric, 2), 'gasto', c_rest, false, false
      );
    end loop;

    -- Transporte: 8 al mes
    for i in 0..7 loop
      insert into _seed_tx values (
        v_deb,
        v_mes + (i * 3),
        (array['TRANSPORTFORNSW OPAL', 'UBER *TRIP', 'BP FUEL 2231'])[1 + (i % 3)],
        (array['Opal', 'Uber', 'BP'])[1 + (i % 3)],
        round((12 + random() * 35)::numeric, 2), 'gasto', c_trans, false, false
      );
    end loop;

    -- Entretenimiento y compras
    insert into _seed_tx values
      (v_cred, v_mes + 9, 'EVENT CINEMAS GEORGE ST', 'Event Cinemas', round((24 + random() * 30)::numeric, 2), 'gasto', c_ent, false, false),
      (v_cred, v_mes + 19, 'TICKETEK AUSTRALIA', 'Ticketek', round((35 + random() * 40)::numeric, 2), 'gasto', c_ent, false, false),
      (v_cred, v_mes + 6, 'AMAZON AU MARKETPLACE', 'Amazon', round((30 + random() * 90)::numeric, 2), 'gasto', c_compras, false, false),
      (v_cred, v_mes + 21, 'KMART 1123', 'Kmart', round((25 + random() * 70)::numeric, 2), 'gasto', c_compras, false, false),
      (v_deb, v_mes + 13, 'CHEMIST WAREHOUSE 88', 'Chemist Warehouse', round((15 + random() * 30)::numeric, 2), 'gasto', c_salud, false, false);
  end loop;

  -- Mes actual: gastos extra para que haya categorías "excedido" y "en riesgo".
  v_mes := date_trunc('month', v_hoy)::date;
  insert into _seed_tx values
    (v_cred, v_mes + 1, 'NOBU SYDNEY CROWN', 'Nobu', 186.00, 'gasto', c_rest, false, false),
    (v_cred, v_mes + 3, 'THE GROUNDS OF ALEXANDRIA', 'The Grounds', 94.50, 'gasto', c_rest, false, false),
    (v_cred, v_mes + 5, 'UBER *EATS ORDER 5521', 'Uber Eats', 62.30, 'gasto', c_rest, false, false),
    (v_deb, v_mes + 2, 'COSTCO WHOLESALE AUBURN', 'Costco', 312.40, 'gasto', c_super, false, false),
    (v_cred, v_mes + 4, 'JB HI-FI ONLINE', 'JB Hi-Fi', 249.00, 'gasto', c_compras, false, false),
    -- Sin categoría: aparecerán en la bandeja "Por revisar".
    (v_deb, v_mes + 1, 'PAYID TRANSFER 8842 J SMITH', null, 60.00, 'gasto', null, false, true),
    (v_cred, v_mes + 2, 'SQ *MARKET STALL 0921', null, 23.50, 'gasto', null, false, true),
    (v_cred, v_mes + 3, 'PAYPAL *DIGITALSVC 4029357733', null, 14.99, 'gasto', null, false, true);

  insert into public.transactions (
    user_id, account_id, fecha, descripcion_original, comercio, monto, tipo,
    category_id, es_recurrente, requiere_revision, hash_unico
  )
  select
    v_user, s.account_id, s.fecha, s.descripcion, s.comercio, s.monto, s.tipo,
    s.category_id, s.recurrente, s.revision,
    encode(
      sha256(convert_to(
        s.fecha::text || '|' || to_char(s.monto, 'FM999999999990.00') || '|' || lower(trim(s.descripcion)),
        'UTF8'
      )),
      'hex'
    )
  from _seed_tx s
  where s.fecha <= v_hoy
  on conflict (user_id, hash_unico) do nothing;

  -- Metas de ahorro y sus aportaciones recientes
  insert into public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, fecha_objetivo)
  values (v_user, 'Fondo de emergencia', 15000, 8200, (v_hoy + interval '10 months')::date)
  returning id into g_fondo;

  insert into public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, fecha_objetivo)
  values (v_user, 'Viaje a Japón', 6000, 1500, (v_hoy + interval '7 months')::date)
  returning id into g_viaje;

  insert into public.savings_contributions (user_id, goal_id, fecha, monto) values
    (v_user, g_fondo, (v_hoy - interval '75 days')::date, 500),
    (v_user, g_fondo, (v_hoy - interval '45 days')::date, 450),
    (v_user, g_fondo, (v_hoy - interval '15 days')::date, 400),
    (v_user, g_viaje, (v_hoy - interval '70 days')::date, 300),
    (v_user, g_viaje, (v_hoy - interval '40 days')::date, 250),
    (v_user, g_viaje, (v_hoy - interval '10 days')::date, 200);

  -- Pagos programados (fechas relativas a hoy para poder probar las alertas)
  insert into public.scheduled_payments (user_id, nombre, monto, frecuencia, proximo_vencimiento, account_id) values
    (v_user, 'Renta', 2200.00, 'mensual', (date_trunc('month', v_hoy) + interval '1 month')::date, v_deb),
    (v_user, 'Internet', 79.00, 'mensual', v_hoy + 2, v_cred),
    (v_user, 'Seguro de auto', 980.00, 'anual', v_hoy + 7, v_deb),
    (v_user, 'Registro del auto', 4200.00, 'unica', v_hoy + 12, v_deb);
end $$;
