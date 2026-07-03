-- tests/rls_tamper_assertions.sql — Option-B hidden-information UPDATE-tamper regression.
-- Companion to rls_assertions.sql (which covers the SELECT path). This proves the OTHER
-- vector: the game-wide UPDATE policy lets any member move another player's card row to a
-- public zone — but with Option B the shared game_card_instances row carries NO identity for
-- hidden zones (the true identity lives only in owner-gated game_card_hidden), so the move
-- reveals nothing. It also proves the legitimate owner can still reconstruct their own card.
--
-- Run as a single script (SQL editor or one MCP execute_sql call) so `set local` holds.
--
-- Fixed UUIDs: C (owner) = 20..04, D (attacker/opponent) = 20..05, game = 20..20,
--   C seat = 25..c5, D seat = 25..d5, C hand card = e0..e0 (blank on row; 'Black Lotus' in hidden).

-- ── SEED (privileged role, bypasses RLS) ─────────────────────────────────────
delete from auth.users where id in ('20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005');
insert into auth.users (id, is_anonymous) values
 ('20000000-0000-4000-8000-000000000004', false),
 ('20000000-0000-4000-8000-000000000005', false);
insert into public.games (id, owner_id, name) values
 ('20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000004','Tamper Test');
insert into public.game_participants (id, game_id, profile_id, seat_index, display_name) values
 ('25000000-0000-4000-8000-0000000000c5','20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000004',0,'C'),
 ('25000000-0000-4000-8000-0000000000d5','20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000005',1,'D');
-- Option B: C's hand card has a BLANK identity on the shared row; the truth is owner-only.
insert into public.game_card_instances (id, game_id, owner_participant_id, controller_participant_id, card_name, scryfall_id, zone) values
 ('e0000000-0000-4000-8000-0000000000e0','20000000-0000-4000-8000-000000000020','25000000-0000-4000-8000-0000000000c5','25000000-0000-4000-8000-0000000000c5','', null,'hand');
insert into public.game_card_hidden (instance_id, game_id, owner_participant_id, card_name) values
 ('e0000000-0000-4000-8000-0000000000e0','20000000-0000-4000-8000-000000000020','25000000-0000-4000-8000-0000000000c5','Black Lotus');

-- ── ATTACK as D: move C's hidden card into a public zone, then try to read it ──
set local request.jwt.claims to '{"sub":"20000000-0000-4000-8000-000000000005","role":"authenticated"}';
set local role authenticated;
-- The game-wide UPDATE policy permits the move itself (griefing is possible; that is acceptable
-- in a manual tabletop). The point of Option B is that the move yields NO hidden information.
update public.game_card_instances
   set zone='battlefield', x=50, y=50
 where id='e0000000-0000-4000-8000-0000000000e0';
select
  -- after the tamper the row is in a public zone and visible to D, but its identity is blank
  (select coalesce(nullif(card_name,''),'<blank>') from public.game_card_instances
     where id='e0000000-0000-4000-8000-0000000000e0')                                            as c_card_name_to_D_EXPECT_blank,
  (select scryfall_id from public.game_card_instances
     where id='e0000000-0000-4000-8000-0000000000e0')                                            as c_scryfall_to_D_EXPECT_null,
  -- D still cannot read C's owner-only true identity
  (select count(*) from public.game_card_hidden
     where owner_participant_id='25000000-0000-4000-8000-0000000000c5')                          as c_true_identity_leak_to_D_EXPECT_0;
reset role;

-- ── VERIFY as C (owner): the legitimate owner can still reconstruct the card ──
set local request.jwt.claims to '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select
  (select card_name from public.game_card_hidden
     where instance_id='e0000000-0000-4000-8000-0000000000e0')                                   as c_own_identity_EXPECT_Black_Lotus;
reset role;

-- ── CLEANUP ──────────────────────────────────────────────────────────────────
delete from auth.users where id in ('20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005');
