-- Startcategorieën voor een lege `categories`-tabel (eerste setup).
-- Idempotent: `on conflict (slug) do nothing` — veilig als je migraties opnieuw draait.

insert into public.categories (name, slug)
values
  ('Algemeen', 'algemeen'),
  ('Clubkleding', 'clubkleding'),
  ('Trainingskleding', 'trainingskleding'),
  ('Accessoires', 'accessoires')
on conflict (slug) do nothing;
