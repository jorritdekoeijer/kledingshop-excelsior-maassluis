-- `products.category_id` verwijst in sommige databases naar `product_categories` (niet `categories`).
-- Deze migratie maakt die tabel idempotent aan en kopieert eventueel rijen uit legacy `public.categories`.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_select_public" on public.product_categories;
create policy "product_categories_select_public" on public.product_categories
  for select
  using (true);

drop policy if exists "product_categories_write_admin" on public.product_categories;
create policy "product_categories_write_admin" on public.product_categories
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

do $sync$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'categories'
  ) then
    insert into public.product_categories (id, name, slug, created_at, updated_at)
    select c.id, c.name, c.slug, c.created_at, c.updated_at
    from public.categories c
    where not exists (select 1 from public.product_categories p where p.id = c.id);
  end if;
end
$sync$;

insert into public.product_categories (name, slug)
values
  ('Algemeen', 'algemeen'),
  ('Clubkleding', 'clubkleding'),
  ('Trainingskleding', 'trainingskleding'),
  ('Accessoires', 'accessoires')
on conflict (slug) do nothing;
