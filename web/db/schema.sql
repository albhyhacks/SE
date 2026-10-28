-- MoveProof schema v1 for SQLite. Port of supabase/migrations/0001_init.sql.
-- The lock triggers at the bottom are the core integrity feature. Do not weaken them.
-- Times are ISO-8601 UTC text. Booleans are 0/1. Ids are UUIDs made in app code.

create table if not exists users (
  id         text primary key,
  email      text not null unique,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists otp_codes (
  email      text primary key,
  code_hash  text not null,
  expires_at text not null,
  attempts   integer not null default 0,
  sent_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists sessions (
  token_hash text primary key,
  user_id    text not null references users(id),
  expires_at text not null
);

create table if not exists tenancies (
  id            text primary key,
  created_by    text not null references users(id),
  address       text not null check (length(trim(address)) > 0),
  state_code    text not null default 'TN' check (state_code in ('TN','MTA','OTHER')),
  monthly_rent  integer not null check (monthly_rent > 0),
  deposit       integer not null check (deposit >= 0),
  move_out_date text,
  invite_code   text not null unique,
  created_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists members (
  tenancy_id   text not null references tenancies(id) on delete cascade,
  user_id      text not null references users(id),
  role         text not null check (role in ('OWNER','TENANT')),
  display_name text not null,
  joined_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  primary key (tenancy_id, user_id),
  unique (tenancy_id, role)
);

create table if not exists rooms (
  id         text primary key,
  tenancy_id text not null references tenancies(id),
  name       text not null,
  sort       integer not null default 0
);

create table if not exists items (
  id          text primary key,
  room_id     text not null references rooms(id),
  name        text not null,
  is_overview integer not null default 0 check (is_overview in (0,1)),
  sort        integer not null default 0
);

create table if not exists reports (
  id            text primary key,
  tenancy_id    text not null references tenancies(id),
  type          text not null check (type in ('MOVE_IN','MOVE_OUT')),
  status        text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','LOCKED')),
  created_by    text not null references users(id),
  content_hash  text check (length(content_hash) = 64 and content_hash not glob '*[^0-9a-f]*'),
  self_attested integer not null default 0 check (self_attested in (0,1)),
  submitted_at  text,
  locked_at     text,
  created_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (tenancy_id, type)
);

create table if not exists entries (
  id               text primary key,
  report_id        text not null references reports(id),
  item_id          text not null references items(id),
  rating           integer check (rating between 1 and 6),
  notes            text,
  reviewer_comment text,
  updated_at       text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (report_id, item_id)
);

create table if not exists photos (
  id          text primary key,
  entry_id    text not null references entries(id),
  sha256      text not null check (length(sha256) = 64 and sha256 not glob '*[^0-9a-f]*'),
  path        text not null,
  source      text not null default 'camera' check (source in ('camera','dev_upload')),
  captured_at text,
  uploaded_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (entry_id, sha256)
);

create table if not exists signatures (
  report_id   text not null references reports(id),
  user_id     text not null references users(id),
  role        text not null check (role in ('OWNER','TENANT')),
  typed_name  text not null check (length(trim(typed_name)) > 1),
  report_hash text not null check (length(report_hash) = 64 and report_hash not glob '*[^0-9a-f]*'),
  signed_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  primary key (report_id, user_id)
);

create table if not exists deductions (
  id           text primary key,
  tenancy_id   text not null references tenancies(id),
  item_id      text not null references items(id),
  amount       integer not null check (amount > 0),
  reason       text not null check (reason in ('CLEANING','DAMAGE','MISSING','OTHER')),
  owner_note   text,
  status       text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','DISPUTED','WITHDRAWN')),
  tenant_note  text,
  created_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  responded_at text
);

create table if not exists audit_events (
  id         integer primary key autoincrement,
  tenancy_id text not null references tenancies(id),
  actor_id   text references users(id),
  action     text not null,
  detail     text not null default '{}' check (json_valid(detail)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create index if not exists rooms_tenancy   on rooms (tenancy_id);
create index if not exists items_room      on items (room_id);
create index if not exists entries_report  on entries (report_id);
create index if not exists photos_entry    on photos (entry_id);
create index if not exists deductions_ten  on deductions (tenancy_id);
create index if not exists audit_ten_time  on audit_events (tenancy_id, created_at);

-- ---------------------------------------------------------------
-- LOCK TRIGGERS (integrity core). SQLite has no trigger functions,
-- so each table/operation gets its own trigger with the same rule.
-- On UPDATE both OLD and NEW parents are checked (nothing may move in or out).
-- ---------------------------------------------------------------

-- 1) Entries, photos and signatures of a LOCKED report cannot be inserted, changed or deleted.
create trigger if not exists entries_lock_ins before insert on entries
when exists (select 1 from reports where id = new.report_id and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists entries_lock_upd before update on entries
when exists (select 1 from reports where id in (old.report_id, new.report_id) and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists entries_lock_del before delete on entries
when exists (select 1 from reports where id = old.report_id and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;

create trigger if not exists photos_lock_ins before insert on photos
when exists (select 1 from entries e join reports r on r.id = e.report_id
             where e.id = new.entry_id and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists photos_lock_upd before update on photos
when exists (select 1 from entries e join reports r on r.id = e.report_id
             where e.id in (old.entry_id, new.entry_id) and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists photos_lock_del before delete on photos
when exists (select 1 from entries e join reports r on r.id = e.report_id
             where e.id = old.entry_id and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;

create trigger if not exists signatures_lock_ins before insert on signatures
when exists (select 1 from reports where id = new.report_id and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists signatures_lock_upd before update on signatures
when exists (select 1 from reports where id in (old.report_id, new.report_id) and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists signatures_lock_del before delete on signatures
when exists (select 1 from reports where id = old.report_id and status = 'LOCKED')
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;

-- 2) A LOCKED report row itself can never be updated or deleted.
create trigger if not exists reports_lock_upd before update on reports
when old.status = 'LOCKED'
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;
create trigger if not exists reports_lock_del before delete on reports
when old.status = 'LOCKED'
begin select raise(abort, 'MoveProof: report is locked and cannot be changed'); end;

-- 3) Once the MOVE_IN report is LOCKED, the checklist (rooms, items) is frozen.
create trigger if not exists rooms_frozen_ins before insert on rooms
when exists (select 1 from reports where tenancy_id = new.tenancy_id and type = 'MOVE_IN' and status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;
create trigger if not exists rooms_frozen_upd before update on rooms
when exists (select 1 from reports where tenancy_id in (old.tenancy_id, new.tenancy_id) and type = 'MOVE_IN' and status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;
create trigger if not exists rooms_frozen_del before delete on rooms
when exists (select 1 from reports where tenancy_id = old.tenancy_id and type = 'MOVE_IN' and status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;

create trigger if not exists items_frozen_ins before insert on items
when exists (select 1 from rooms ro join reports r on r.tenancy_id = ro.tenancy_id
             where ro.id = new.room_id and r.type = 'MOVE_IN' and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;
create trigger if not exists items_frozen_upd before update on items
when exists (select 1 from rooms ro join reports r on r.tenancy_id = ro.tenancy_id
             where ro.id in (old.room_id, new.room_id) and r.type = 'MOVE_IN' and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;
create trigger if not exists items_frozen_del before delete on items
when exists (select 1 from rooms ro join reports r on r.tenancy_id = ro.tenancy_id
             where ro.id = old.room_id and r.type = 'MOVE_IN' and r.status = 'LOCKED')
begin select raise(abort, 'MoveProof: checklist is frozen after move-in lock'); end;

-- 4) Audit events are append-only.
create trigger if not exists audit_no_update before update on audit_events
begin select raise(abort, 'MoveProof: audit events are append-only'); end;
create trigger if not exists audit_no_delete before delete on audit_events
begin select raise(abort, 'MoveProof: audit events are append-only'); end;

-- 5) Entries and deductions may only point at items of their own tenancy.
create trigger if not exists entries_same_tenancy before insert on entries
when (select ro.tenancy_id from items i join rooms ro on ro.id = i.room_id where i.id = new.item_id)
  is not (select tenancy_id from reports where id = new.report_id)
begin select raise(abort, 'MoveProof: item belongs to another tenancy'); end;
create trigger if not exists entries_no_reparent before update of report_id, item_id on entries
when new.report_id is not old.report_id or new.item_id is not old.item_id
begin select raise(abort, 'MoveProof: entries cannot be moved'); end;
create trigger if not exists deductions_same_tenancy before insert on deductions
when (select ro.tenancy_id from items i join rooms ro on ro.id = i.room_id where i.id = new.item_id)
  is not new.tenancy_id
begin select raise(abort, 'MoveProof: item belongs to another tenancy'); end;
create trigger if not exists deductions_no_reparent before update of tenancy_id, item_id on deductions
when new.tenancy_id is not old.tenancy_id or new.item_id is not old.item_id
begin select raise(abort, 'MoveProof: deductions cannot be moved'); end;
