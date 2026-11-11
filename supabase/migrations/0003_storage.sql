-- Asesor Financiero · 0003 · Storage
-- Bucket privado para los estados de cuenta en PDF. Cada usuario solo accede
-- a su propia carpeta: estados-de-cuenta/<user_id>/archivo.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estados-de-cuenta',
  'estados-de-cuenta',
  false,
  20971520, -- 20 MB
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "estados_leer_propios" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'estados-de-cuenta'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "estados_subir_propios" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'estados-de-cuenta'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "estados_borrar_propios" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'estados-de-cuenta'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
