-- Execute este script no SQL Editor do Supabase.
-- Ele cria tabelas, RLS/policies, perfis e provisiona o admin solicitado.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  role text not null default 'administrativo' check (role in ('administrador', 'administrativo')),
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('dinheiro', 'pix', 'debito', 'cartao', 'outros')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dt date not null,
  type text not null check (type in ('receita', 'despesa')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null,
  category_id uuid null references public.categories(id) on delete set null,
  account_id uuid null references public.accounts(id) on delete set null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_dt on public.transactions(dt);
create index if not exists idx_transactions_user_dt on public.transactions(user_id, dt);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid();
$$;

grant execute on function public.current_app_role() to anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, role)
  values (new.id, lower(new.email), 'administrativo')
  on conflict (user_id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own_or_admin
on public.profiles
for select
using (auth.uid() = user_id or public.current_app_role() = 'administrador');

create policy profiles_update_admin
on public.profiles
for update
using (public.current_app_role() = 'administrador')
with check (public.current_app_role() = 'administrador');

drop policy if exists accounts_select_authenticated on public.accounts;
drop policy if exists accounts_insert_admin on public.accounts;
drop policy if exists accounts_update_admin on public.accounts;
drop policy if exists accounts_delete_admin on public.accounts;
drop policy if exists accounts_select_own on public.accounts;
drop policy if exists accounts_insert_own on public.accounts;
drop policy if exists accounts_update_own on public.accounts;
drop policy if exists accounts_delete_own on public.accounts;

create policy accounts_select_authenticated
on public.accounts
for select
using (auth.role() = 'authenticated');

create policy accounts_insert_admin
on public.accounts
for insert
with check (public.current_app_role() = 'administrador');

create policy accounts_update_admin
on public.accounts
for update
using (public.current_app_role() = 'administrador')
with check (public.current_app_role() = 'administrador');

create policy accounts_delete_admin
on public.accounts
for delete
using (public.current_app_role() = 'administrador');

drop policy if exists categories_select_authenticated on public.categories;
drop policy if exists categories_insert_admin on public.categories;
drop policy if exists categories_update_admin on public.categories;
drop policy if exists categories_delete_admin on public.categories;
drop policy if exists categories_select_own on public.categories;
drop policy if exists categories_insert_own on public.categories;
drop policy if exists categories_update_own on public.categories;
drop policy if exists categories_delete_own on public.categories;

create policy categories_select_authenticated
on public.categories
for select
using (auth.role() = 'authenticated');

create policy categories_insert_admin
on public.categories
for insert
with check (public.current_app_role() = 'administrador');

create policy categories_update_admin
on public.categories
for update
using (public.current_app_role() = 'administrador')
with check (public.current_app_role() = 'administrador');

create policy categories_delete_admin
on public.categories
for delete
using (public.current_app_role() = 'administrador');

drop policy if exists transactions_select_own_or_admin on public.transactions;
drop policy if exists transactions_insert_own_or_admin on public.transactions;
drop policy if exists transactions_update_own_or_admin on public.transactions;
drop policy if exists transactions_delete_own_or_admin on public.transactions;
drop policy if exists transactions_select_own on public.transactions;
drop policy if exists transactions_insert_own on public.transactions;
drop policy if exists transactions_update_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;

create policy transactions_select_own_or_admin
on public.transactions
for select
using (public.current_app_role() = 'administrador' or user_id = auth.uid());

create policy transactions_insert_own_or_admin
on public.transactions
for insert
with check (public.current_app_role() = 'administrador' or user_id = auth.uid());

create policy transactions_update_own_or_admin
on public.transactions
for update
using (public.current_app_role() = 'administrador' or user_id = auth.uid())
with check (public.current_app_role() = 'administrador' or user_id = auth.uid());

create policy transactions_delete_own_or_admin
on public.transactions
for delete
using (public.current_app_role() = 'administrador' or user_id = auth.uid());

create or replace function public.normalize_auth_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_col text;
begin
  update auth.users
  set aud = coalesce(aud, 'authenticated'),
      role = coalesce(role, 'authenticated'),
      raw_app_meta_data = coalesce(raw_app_meta_data, jsonb_build_object('provider', 'email', 'providers', array['email'])),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
      updated_at = now()
  where id = p_user_id;

  foreach v_col in array array[
    'confirmation_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'email_change',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = v_col
    ) then
      execute format(
        'update auth.users set %1$I = coalesce(%1$I, '''') where id = $1',
        v_col
      ) using p_user_id;
    end if;
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    execute 'update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1'
    using p_user_id;
  end if;
end;
$$;

create or replace function public.admin_create_user(p_email text, p_password text, p_role text default 'administrativo')
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_role text := lower(trim(p_role));
  v_uid uuid := gen_random_uuid();
begin
  if public.current_app_role() <> 'administrador' then
    raise exception 'Acesso negado';
  end if;

  if v_role not in ('administrador', 'administrativo') then
    raise exception 'Perfil inválido';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Senha deve ter no mínimo 6 caracteres';
  end if;

  if exists(select 1 from auth.users where email = v_email) then
    raise exception 'Email já cadastrado';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email),
    'email',
    v_email,
    now(),
    now(),
    now()
  );

  perform public.normalize_auth_user(v_uid);

  insert into public.profiles (user_id, email, role)
  values (v_uid, v_email, v_role)
  on conflict (user_id) do update
  set email = excluded.email,
      role = excluded.role;

  return v_uid;
end;
$$;

grant execute on function public.admin_create_user(text, text, text) to authenticated;

do $$
declare
  v_admin_email text := 'mauroramirescg@gmail.com';
  v_admin_password text := '230160';
  v_admin_id uuid;
begin
  select id into v_admin_id
  from auth.users
  where email = v_admin_email
  limit 1;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      extensions.crypt(v_admin_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      '{}'::jsonb,
      now(),
      now(),
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email),
      'email',
      v_admin_email,
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt(v_admin_password, extensions.gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    where id = v_admin_id;

    if not exists (
      select 1
      from auth.identities
      where user_id = v_admin_id
        and provider = 'email'
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        v_admin_id,
        jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email),
        'email',
        v_admin_email,
        now(),
        now(),
        now()
      );
    end if;
  end if;

  perform public.normalize_auth_user(v_admin_id);

  insert into public.profiles (user_id, email, role)
  values (v_admin_id, v_admin_email, 'administrador')
  on conflict (user_id) do update
  set email = excluded.email,
      role = 'administrador';
end
$$;

do $$
declare
  r record;
begin
  for r in (select id from auth.users)
  loop
    perform public.normalize_auth_user(r.id);
  end loop;
end
$$;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update(role) on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
