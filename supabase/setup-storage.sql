-- Rode no Supabase: SQL Editor > New query > cole tudo > Run

-- 1) Bucket público (limite de 10 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit)
values ('fotos-camera', 'fotos-camera', true, 10485760)
on conflict (id) do update set public = true;

-- 2) Políticas (RLS): leitura e envio liberados para o app
drop policy if exists "Leitura publica fotos-camera" on storage.objects;
create policy "Leitura publica fotos-camera"
  on storage.objects for select
  using (bucket_id = 'fotos-camera');

drop policy if exists "Upload publico fotos-camera" on storage.objects;
create policy "Upload publico fotos-camera"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'fotos-camera');
