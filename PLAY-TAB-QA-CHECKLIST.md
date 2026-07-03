# Play Tab — QA / Bugtest Checklist

Scope: the Play tab (mode-select → lobby → playmat → full-screen game + HUD). Deck Builder and Life Counter are out of scope.
Run locally (the in-app sandbox here can't render the real files — see note at bottom). Check each box; jot the symptom on any ✗.

---

## 0. Launch & entry
- [ ] App loads with no console errors (open DevTools → Console).
- [ ] Top nav shows **Life counter / Deck builder / Play**.
- [ ] Click **Play** → the global header/logo disappears and a full-screen **mode-select** screen appears (Commander / Draft Commander / Planechase / 20 Life).
- [ ] Your name field is prefilled; the color swatch cycles colors on click.
- [ ] **‹ Back to app** returns to the Life counter.

## 1. Lobby / deck (img 4)
- [ ] Pick **Commander** → lobby screen with **Solo / Online** toggle.
- [ ] **Choose Your Deck and Play** expands the deck panel.
- [ ] **Sample deck (Krenko)** is listed; any saved decks appear below it.
- [ ] Paste a Moxfield/Archidekt list into the import box → **Import & Play** is accepted.
- [ ] **Online** toggle reveals the invite-code field; **Solo** hides it.

## 2. Playmat picker (img 5)
- [ ] After choosing a deck, the **Select your playmat** modal opens.
- [ ] Tabs: **Colors / MTG art / Upload**.
- [ ] **Colors** shows the solid swatches; selecting one highlights it.
- [ ] **MTG art** loads Scryfall full-art lands (art_crop thumbnails). Loads within a few seconds; no layout break.
- [ ] **Upload** accepts an image URL.
- [ ] **Select & Place** applies the mat and launches the game; **‹ Back** / ✕ return to lobby.

## 3. Game entry & opening hand (img 7)
- [ ] Board fills the screen (no collapsed/0-height board).
- [ ] **Opening Hand** modal shows 7 readable card images.
- [ ] **Mulligan** reshuffles and draws a new 7.
- [ ] **Keep hand** dismisses the modal and reveals the board.

## 4. Top bar + taskbar HUD (img 4 / windows-bar)
- [ ] Core bar is **one line**: phases + mana (life now lives in the top-right panel — confirm that's what you want).
- [ ] Taskbar shows: lobby, untap, draw, mulligan, undo, **dice**, **trackers**, **log toggle**, fullscreen, help, settings.
- [ ] **Dice** → Roll Dice popup (coin / quick die / custom). Roll prints a result to the log.
- [ ] **Trackers** → popup with the counter grid + filter pills + custom add; toggles persist (localStorage).
- [ ] **Log toggle** hides/shows the right rail for a clean full-screen board.
- [ ] **Settings** → Change playmat / Shuffle library / End game all fire.

## 5. Life panel (top-right, img 4)
- [ ] Panel shows your name, color swatch, life with **− / +**.
- [ ] Commander card art appears as a faint background (low opacity).
- [ ] **Commander damage** opens the matrix.
- [ ] Library / Graveyard / Exile counts shown and update as cards move.
- [ ] **Watch-item:** life panel (top-right) and the log rail must not overlap — if they collide, toggle the log off and note it.

## 6. Board, zones, cards
- [ ] Pan (drag empty board) and zoom (scroll); **0** recenters.
- [ ] Per-player zones colorized: **Library blue / Graveyard red / Exile purple / Command gold**.
- [ ] Drag a card from hand → it **shrinks to normal size while dragging** (doesn't cover the drop spot) and drops on the board.
- [ ] Hand hover = a **gentle** ~1.4× zoom (not explosive/jerky), image stays crisp.
- [ ] Hovering a board card shows the **exploded preview on the LEFT**, correct aspect ratio (not stretched).
- [ ] You **cannot** draw from an opponent's library; your own works.

## 7. Right-click menu (img 3)
- [ ] Right-click a card → cleaned menu with shortcut chips (T/F/A/G/E/X/I…).
- [ ] **Create token…** opens the search popup → search a token → pick art → set quantity → **Spawn** places them on the board.
- [ ] Hotkeys work on hovered card: T tap, F flip, G graveyard, E exile, X clone, I inspect, D draw, U untap, Z undo.

## 8. Action log (img 5)
- [ ] Right rail shows the **"Action log"** header (added this session).
- [ ] Log reads out player + phase (e.g. "<name> moved to Main 1"), not "set phase".
- [ ] Entries append on actions (move/tap/draw/roll/life).

## 9. Leave / re-enter
- [ ] **‹ Lobby** returns to the lobby without errors; re-launching works.
- [ ] Switching to Life counter / Deck builder cleanly exits full-screen.

---

## Changed this session
- Added the **"Action log"** header to the right-rail log panel (`index.html` + `play-shell.css`).
- Verified the three core Play files (`table.js`, `play-shell.js`, `play-hud.js`) are complete and syntactically clean in the real working copy; spliced-syntax-checked the `table.js` engine end-to-end.

## Open decisions (pick one when you're back)
1. **You test, I fix** — report any ✗ above and I fix immediately.
2. **Plan multiplayer** (PROMPT 3) — I draft architecture + issues for review first.
3. **Polish one area** — name it (life panel / taskbar / hand / menu / tokens / log).
4. **Engine → board wiring** — start binding the rules engine behind a flag (planned first).

## Note on automated verification
The Linux sandbox that powers headless screenshots here serves **stale/truncated** copies of most edited files (`app.js`, `deck-builder.js`, `table.js`, the CSS, etc.), so I can't faithfully render your app from here — this is a tooling artifact, **not** a problem with your real files (confirmed complete via direct read). Your local run is the source of truth.
