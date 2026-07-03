-- tests/rls_assertions.sql — PROMPT 0 hidden-information verification.
-- Run against the Supabase project via the SQL editor or MCP execute_sql.
-- Proves: opponents cannot read another player's hand/library or a face-down card's
-- true identity; opponents DO see public-zone rows + hand COUNTS; a member can append
-- actions only as themselves (and the action_type column is now free TEXT, not an enum).
--
-- Pattern: seed as the privileged role (bypasses RLS), then assert under a player's JWT
-- by `set local request.jwt.claims` + `set local role authenticated` in one transaction.
--
-- Fixed UUIDs: A (owner) = a0..01, B (opponent) = b0..02, game = 10..10,
--   A seat = a5..a5, B seat = b5..b5, A hand card = c0..c0, A face-down bf = c1..c1, B hand = c2..c2.

-- ── SEED (privileged) ────────────────────────────────────────────────────────
delete from auth.users where id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
insert into auth.users (id, is_anonymous) values
 ('a0000000-0000-4000-8000-000000000001', false),
 ('b0000000-0000-4000-8000-000000000002', false);
insert into public.games (id, owner_id, name) values
 ('10000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001','RLS Test');
insert into public.game_participants (id, game_id, profile_id, seat_index, display_name) values
 ('a5000000-0000-4000-8000-0000000000a5','10000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001',0,'A'),
 ('b5000000-0000-4000-8000-0000000000b5','10000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000002',1,'B');
insert into public.game_card_instances (id, game_id, owner_participant_id, controller_participant_id, card_name, zone) values
 ('c0000000-0000-4000-8000-0000000000c0','10000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-0000000000a5','a5000000-0000-4000-8000-0000000000a5','Sol Ring','hand'),
 ('c2000000-0000-4000-8000-0000000000c2','10000000-0000-4000-8000-000000000010','b5000000-0000-4000-8000-0000000000b5','b5000000-0000-4000-8000-0000000000b5','Llanowar Elves','hand');
insert into public.game_card_instances (id, game_id, owner_participant_id, controller_participant_id, card_name, zone, face_down, x, y) values
 ('c1000000-0000-4000-8000-0000000000c1','10000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-0000000000a5','a5000000-0000-4000-8000-0000000000a5','','battlefield',true,10,20);
insert into public.game_card_hidden (instance_id, game_id, owner_participant_id, card_name) values
 ('c1000000-0000-4000-8000-0000000000c1','10000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-0000000000a5','Grizzly Bears');

-- ── ASSERT as B (opponent) ───────────────────────────────────────────────────
set local request.jwt.claims to '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select
  (select count(*) from public.game_card_instances where owner_participant_id='a5000000-0000-4000-8000-0000000000a5' and zone='hand') as a_hand_leak_EXPECT_0,
  (select count(*) from public.game_card_hidden    where owner_participant_id='a5000000-0000-4000-8000-0000000000a5') as a_facedown_identity_leak_EXPECT_0,
  (select count(*) from public.game_card_instances where owner_participant_id='b5000000-0000-4000-8000-0000000000b5' and zone='hand') as b_own_hand_EXPECT_1,
  (select coalesce(nullif(card_name,''),'<blank>') from public.game_card_instances where id='c1000000-0000-4000-8000-0000000000c1') as a_facedown_name_to_b_EXPECT_blank,
  (select count(*) from public.game_card_instances where id='c1000000-0000-4000-8000-0000000000c1') as a_facedown_row_visible_EXPECT_1,
  (select n from public.zone_counts('10000000-0000-4000-8000-000000000010') where owner_participant_id='a5000000-0000-4000-8000-0000000000a5' and zone='hand') as a_hand_count_via_fn_EXPECT_1;
reset role;

-- Member can append as self (EXPECT success; also proves action_type is free TEXT):
--   set local ... B; insert game_actions(actor_id=B, action_type='card_tap', ...) returning id;
-- Spoof must fail (EXPECT RLS violation):
--   set local ... B; insert game_actions(actor_id=A, ...) -> new row violates row-level security policy

-- ── CLEANUP ──────────────────────────────────────────────────────────────────
-- delete from auth.users where id in ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
