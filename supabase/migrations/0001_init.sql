-- MoveProof schema v1 (MVP)
-- Run once in the Supabase SQL editor (or with the Supabase CLI).
-- The lock triggers at the bottom are the core integrity feature. Do not weaken them.

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table public.tenancies (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users(id),
  address       text not null check (length(trim(address)) > 0),
  state_code    text not null default 'TN' check (state_code in ('TN','MTA','OTHER')),
  monthly_rent  integer not null check (monthly_rent > 0),          -- rupees
  deposit       integer not null check (deposit >= 0),              -- rupees
  move_out_date date,
  invite_code   text not null unique,                                -- generated in app code
  created_at    timestamptz not null default now()
);

create table public.members (
  tenancy_id   uuid not null references public.tenancies(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  role         text not null check (role in ('OWNER','TENANT')),
  display_name text not null,
  joined_at    timestamptz not null default now(),
  primary key (tenancy_id, user_id),
  unique (tenancy_id, role)                                          -- one owner, one tenant in MVP
);

create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id),
  name       text not null,
  sort       integer not null default 0
);

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id),
  name        text not null,
  is_overview boolean not null default false,                        -- "Room overview" item, photo always required
  sort        integer not null default 0
);

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  tenancy_id    uuid not null references public.tenancies(id),
  type          text not null check (type in ('MOVE_IN','MOVE_OUT')),
  status        text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','LOCKED')),
  created_by    uuid not null references auth.users(id),           -- the initiator of this report
  content_hash  text check (content_hash ~ '^[0-9a-f]{64}$'),
  self_attested boolean not null default false,
  submitted_at  timestamptz,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (tenancy_id, type)
);

create table public.entries (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.reports(id),
  item_id          uuid not null references public.items(id),
  rating           smallint check (rating between 1 and 6),
  notes            text,
  reviewer_comment text,
  updated_at       timestamptz not null default now(),
  unique (report_id, item_id)
);

create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id),
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  path        text not null,
  source      text not null default 'camera' check (source in ('camera','dev_upload')),
  captured_at timestamptz,                                           -- client-reported, informational only
  uploaded_at timestamptz not null default now(),                    -- server time, authoritative
  unique (entry_id, sha256)
);

create table public.signatures (
  report_id   uuid not null references public.reports(id),
  user_id     uuid not null references auth.users(id),
  role        text not null check (role in ('OWNER','TENANT')),
  typed_name  text not null check (length(trim(typed_name)) > 1),
  report_hash text not null check (report_hash ~ '^[0-9a-f]{64}$'),
  signed_at   timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table public.deductions (
  id           uuid primary key default gen_random_uuid(),
  tenancy_id   uuid not null references public.tenancies(id),
  item_id      uuid not null references public.items(id),
  amount       integer not null check (amount > 0),                 -- rupees
  reason       text not null check (reason in ('CLEANING','DAMAGE','MISSING','OTHER')),
  owner_note   text,
  status       text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','DISPUTED','WITHDRAWN')),
  tenant_note  text,
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create table public.audit_events (
  id         bigint generated always as identity primary key,
  tenancy_id uuid not null references public.tenancies(id),
  actor_id   uuid references auth.users(id),
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.rooms (tenancy_id);
create index on public.items (room_id);
create index on public.entries (report_id);
create index on public.photos (entry_id);
create index on public.deductions (tenancy_id);
create index on public.audit_events (tenancy_id, created_at);

-- ---------------------------------------------------------------
-- Row level security: ON everywhere, NO policies.
-- Browser clients (anon / authenticated) can read or write nothing.
-- The app uses the service-role key in server actions only.
-- ---------------------------------------------------------------

alter table public.tenancies    enable row level security;
alter table public.members      enable row level security;
alter table public.rooms        enable row level security;
alter table public.items        enable row level security;
alter table public.reports      enable row level security;
alter table public.entries      enable row level security;
alter table public.photos       enable row level security;
alter table public.signatures   enable row level security;
alter table public.deductions   enable row level security;
alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------
-- Storage: private bucket. No policies; uploads use signed upload URLs
-- created by the server, downloads use short-lived signed URLs.
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- LOCK TRIGGERS (integrity core)
-- ---------------------------------------------------------------

-- 1) Entries, photos and signatures of a LOCKED report cannot be inserted, changed or deleted.
create or replace function public.block_if_report_locked() returns trigger
language plpgsql as $$
declare
  r   record;
  rid uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;

  if tg_table_name in ('entries', 'signatures') then
    rid := r.report_id;
  elsif tg_table_name = 'photos' then
    select e.report_id into rid from public.entries e where e.id = r.entry_id;
  end if;

  if exists (select 1 from public.reports where id = rid and status = 'LOCKED') then
    raise exception 'MoveProof: report % is locked and cannot be changed', rid
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger entries_lock    before insert or update or delete on public.entries
  for each row execute function public.block_if_report_locked();
create trigger photos_lock     before insert or update or delete on public.photos
  for each row execute function public.block_if_report_locked();
create trigger signatures_lock before insert or update or delete on public.signatures
  for each row execute function public.block_if_report_locked();

-- 2) A LOCKED report row itself can never be updated or deleted.
create or replace function public.block_locked_report() returns trigger
language plpgsql as $$
begin
  if old.status = 'LOCKED' then
    raise exception 'MoveProof: report % is locked and cannot be changed', old.id
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger reports_lock before update or delete on public.reports
  for each row execute function public.block_locked_report();

-- 3) Once the MOVE_IN report is LOCKED, the checklist (rooms, items) is frozen,
--    so the move-out report captures exactly the same items.
create or replace function public.block_if_checklist_frozen() returns trigger
language plpgsql as $$
declare
  r   record;
  tid uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;

  if tg_table_name = 'rooms' then
    tid := r.tenancy_id;
  else
    select ro.tenancy_id into tid from public.rooms ro where ro.id = r.room_id;
  end if;

  if exists (select 1 from public.reports
             where tenancy_id = tid and type = 'MOVE_IN' and status = 'LOCKED') then
    raise exception 'MoveProof: checklist for tenancy % is frozen after move-in lock', tid
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger rooms_frozen before insert or update or delete on public.rooms
  for each row execute function public.block_if_checklist_frozen();
create trigger items_frozen before insert or update or delete on public.items
  for each row execute function public.block_if_checklist_frozen();

-- 4) Audit events are append-only.
create or replace function public.block_audit_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'MoveProof: audit events are append-only' using errcode = 'P0001';
end $$;

create trigger audit_append_only before update or delete on public.audit_events
  for each row execute function public.block_audit_changes();
