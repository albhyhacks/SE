-- Manual integrity check. Run in the Supabase SQL editor AFTER you have a LOCKED report.
-- Replace the id below with a real locked report id (see the reports table).
-- Every statement must FAIL with "MoveProof: ... is locked". If any succeeds, the lock is broken.

-- 1) Changing an entry of a locked report
update public.entries set notes = 'tampered'
where report_id = '00000000-0000-0000-0000-000000000000';

-- 2) Deleting a photo row of a locked report
delete from public.photos
where entry_id in (select id from public.entries where report_id = '00000000-0000-0000-0000-000000000000');

-- 3) Unlocking the report
update public.reports set status = 'DRAFT'
where id = '00000000-0000-0000-0000-000000000000';

-- 4) Changing the checklist after move-in lock
update public.items set name = 'tampered'
where room_id in (select r.id from public.rooms r
                  join public.reports rep on rep.tenancy_id = r.tenancy_id
                  where rep.id = '00000000-0000-0000-0000-000000000000');

-- Run each statement on its own; each should raise an error.
-- If one reports "UPDATE 0" / "DELETE 0" instead, the id matched no rows (row triggers only
-- fire on real rows): fix the id and run it again. That is not a pass.
