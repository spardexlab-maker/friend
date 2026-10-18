begin;

create table if not exists public.rafiq_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (length(key) between 1 and 240),
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,key)
);
create index if not exists rafiq_documents_updated on public.rafiq_documents(user_id,updated_at);
alter table public.rafiq_documents enable row level security;
revoke all on public.rafiq_documents from anon;
grant select, insert, update, delete on public.rafiq_documents to authenticated;
drop policy if exists rafiq_owner on public.rafiq_documents;
create policy rafiq_owner on public.rafiq_documents for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Each document has an expected version. Conflicts are returned, never overwritten silently.
create or replace function public.rafiq_apply_changes(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  current_row public.rafiq_documents%rowtype;
  saved public.rafiq_documents%rowtype;
  output jsonb := '[]'::jsonb;
  expected bigint;
  doc_key text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 200 then
    raise exception 'Invalid change batch';
  end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    doc_key := item->>'key'; expected := (item->>'expected_version')::bigint;
    if doc_key is null or length(doc_key) > 240 or expected is null or expected < 0 then raise exception 'Invalid document'; end if;
    -- Serializes insert/update for this owner+key, including rows that do not exist yet.
    perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || doc_key,0));
    select * into current_row from public.rafiq_documents where user_id=uid and key=doc_key for update;
    if not found then
      if expected <> 0 then
        output := output || jsonb_build_array(jsonb_build_object('key',doc_key,'status','conflict','remote',null));
        continue;
      end if;
      insert into public.rafiq_documents(user_id,key,payload,version,deleted)
      values(uid,doc_key,coalesce(item->'payload','{}'::jsonb),1,coalesce((item->>'deleted')::boolean,false)) returning * into saved;
    else
      if current_row.version <> expected then
        output := output || jsonb_build_array(jsonb_build_object('key',doc_key,'status','conflict','remote',to_jsonb(current_row)));
        continue;
      end if;
      update public.rafiq_documents set payload=coalesce(item->'payload','{}'::jsonb),
        deleted=coalesce((item->>'deleted')::boolean,false),version=version+1,updated_at=now()
      where user_id=uid and key=doc_key returning * into saved;
    end if;
    output := output || jsonb_build_array(jsonb_build_object('key',doc_key,'status','saved','remote',to_jsonb(saved)));
  end loop;
  return output;
end $$;
revoke all on function public.rafiq_apply_changes(jsonb) from public, anon;
grant execute on function public.rafiq_apply_changes(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rafiq-private','rafiq-private',false,6000000,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=6000000,allowed_mime_types=array['image/jpeg'];
drop policy if exists rafiq_photo_select on storage.objects;
drop policy if exists rafiq_photo_insert on storage.objects;
drop policy if exists rafiq_photo_update on storage.objects;
drop policy if exists rafiq_photo_delete on storage.objects;
create policy rafiq_photo_select on storage.objects for select to authenticated
using (bucket_id='rafiq-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy rafiq_photo_insert on storage.objects for insert to authenticated
with check (bucket_id='rafiq-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy rafiq_photo_update on storage.objects for update to authenticated
using (bucket_id='rafiq-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='rafiq-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy rafiq_photo_delete on storage.objects for delete to authenticated
using (bucket_id='rafiq-private' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Used only by an authenticated caller to erase their own cloud records and photos.
create or replace function public.rafiq_erase_my_data()
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 delete from public.rafiq_documents where user_id=auth.uid();
end $$;
revoke all on function public.rafiq_erase_my_data() from public,anon;
grant execute on function public.rafiq_erase_my_data() to authenticated;
commit;
