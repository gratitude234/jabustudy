-- Align older study_material_chunks tables with the current chunk indexer.
-- The original bootstrap used page/content; current app code uses page_number/text/text_hash.

create extension if not exists pgcrypto;

alter table public.study_material_chunks
  add column if not exists page_number integer,
  add column if not exists text text,
  add column if not exists text_hash text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_material_chunks'
      and column_name = 'page'
  ) then
    update public.study_material_chunks
      set page_number = page
      where page_number is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_material_chunks'
      and column_name = 'content'
  ) then
    update public.study_material_chunks
      set text = content
      where text is null;
  end if;
end $$;

update public.study_material_chunks
  set text = ''
  where text is null;

update public.study_material_chunks
  set text_hash = encode(digest(coalesce(page_number::text, '') || ':' || text, 'sha256'), 'hex')
  where text_hash is null;

alter table public.study_material_chunks
  alter column text set not null,
  alter column text_hash set not null;

create index if not exists study_material_chunks_material_idx
  on public.study_material_chunks(material_id, chunk_index);

create index if not exists study_material_chunks_page_idx
  on public.study_material_chunks(material_id, page_number);
