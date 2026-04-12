-- Iedereen (ook anonieme bezoekers) mag de homepage-instellingen lezen voor publieke content.
-- Alleen de rij met key 'homepage' — geen SMTP/Mollie-keys.

drop policy if exists "settings_select_homepage_public" on public.settings;

create policy "settings_select_homepage_public" on public.settings
  for select
  using (key = 'homepage');
