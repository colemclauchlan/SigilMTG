-- Spectator gate on join_game (2026-07-06, Task 2 of the live-cursors/spectator/pins sync work).
--
-- PROBLEM: join_game unconditionally assigns a new seat to anyone calling it, even after the host
-- has started the game. A player opening the share link/code post-start should become a read-only
-- SPECTATOR (no seat, no deck, no interaction) instead of getting seated as an extra player.
--
-- "Started" is tracked in games.settings->>'started' (jsonb, host-set via set_game_settings at the
-- moment they enter the live table in afterStart()/persistMyDeck path -- see play-shell.js). There is
-- no dedicated "started" column; settings jsonb already exists and is exactly this kind of flag.
--
-- This function must run SECURITY DEFINER (bypasses RLS) because a not-yet-member caller cannot
-- read a PRIVATE game's row at all under "games member read" (is_game_member) -- the spectator-gate
-- check itself needs definer rights to see games.settings before membership exists.
--
-- Design: when started, do NOT insert a game_participants row at all (avoids seat_index collisions
-- and avoids granting is_game_member -- the client is expected to send them to the existing read-only
-- spectate path instead, which today only works for visibility='public' games per the
-- 20260702010000_public_spectate_read migration). The response carries { spectate: true, visibility }
-- so the client can decide what to show (live board mirror for public, an honest "can't spectate a
-- private game in progress" message for private -- no new capability is silently granted here).
create or replace function public.join_game(p_game uuid, p_display_name text default null::text, p_life integer default null::integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_me public.game_participants%rowtype;
  v_seat int;
  v_existed boolean := true;
  v_started boolean;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  select * into v_game from public.games where id = p_game;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.completed_at is not null then
    raise exception 'game already finished';
  end if;

  -- Already-seated players (including the host, and anyone who joined pre-start) keep their seat
  -- regardless of "started" -- this gate only blocks a FRESH join attempt after the game is live.
  select * into v_me from public.game_participants where game_id = p_game and profile_id = v_uid limit 1;
  if found then
    return jsonb_build_object(
      'participant_id', v_me.id,
      'seat_index', v_me.seat_index,
      'existed', true,
      'spectate', false,
      'participants', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'seat_index', p.seat_index, 'display_name', p.display_name,
          'life_total', p.life_total, 'profile_id', p.profile_id
        ) order by p.seat_index), '[]'::jsonb)
        from public.game_participants p where p.game_id = p_game
      )
    );
  end if;

  v_started := coalesce((v_game.settings->>'started')::boolean, false);
  if v_started then
    return jsonb_build_object(
      'participant_id', null,
      'seat_index', null,
      'existed', false,
      'spectate', true,
      'visibility', v_game.visibility,
      'participants', '[]'::jsonb
    );
  end if;

  -- serialize seat assignment per game (two joiners racing would otherwise collide on seat_index)
  perform pg_advisory_xact_lock(hashtext(p_game::text));
  select coalesce(max(seat_index), -1) + 1 into v_seat from public.game_participants where game_id = p_game;
  if v_seat >= 8 then
    raise exception 'game is full';
  end if;
  insert into public.game_participants (game_id, profile_id, seat_index, display_name, life_total)
  values (
    p_game, v_uid, v_seat,
    coalesce(nullif(trim(coalesce(p_display_name, '')), ''), 'Player ' || (v_seat + 1)),
    coalesce(p_life, v_game.starting_life, 40)
  )
  returning * into v_me;
  v_existed := false;

  return jsonb_build_object(
    'participant_id', v_me.id,
    'seat_index', v_me.seat_index,
    'existed', v_existed,
    'spectate', false,
    'participants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'seat_index', p.seat_index, 'display_name', p.display_name,
        'life_total', p.life_total, 'profile_id', p.profile_id
      ) order by p.seat_index), '[]'::jsonb)
      from public.game_participants p where p.game_id = p_game
    )
  );
end;
$function$;

grant execute on function public.join_game(uuid, text, integer) to authenticated, anon;
