# Play-Tab Parity Gaps (vanilla → React) — 84 gaps

By area: entry-modeselect=6, lobby-deck=7, playmat-picker=8, opening-hand=5, hud-taskbar=9, trackers=7, settings-help=6, life-panel=6, board-zones=3, hand-hover-preview=6, rightclick-hotkeys=16, action-log=5

## entry-modeselect (6)
- [ ] **[H/missing] Full-screen mode-select entry screen before the table**
      vanilla: play-shell.js builds a dedicated full-screen entry screen via buildModeScreen() (lines 36-75). open() (lines 83-90) adds body.play-fs, activates the shell, and show("mode") so the very first thing the user sees when entering Play is the mode-select screen (ps-mode), NOT the table. Only after onPickM
      react: App.tsx routes '/play' directly to <Tabletop /> (App.tsx line 40). Tabletop.tsx (default export, lines 396-407) reads ?roomId and immediately renders TabletopSolo or TabletopOnline ? i.e. the board itself. There is no intermediate mode-sele
      how: Add a new entry screen component (e.g. web/src/pages/PlayEntry.tsx) and point the '/play' route at it in App.tsx instead of Tabletop. It should render the mode grid + name field + color swatch, and only navigate to the table/lobby once a mode is picked. Keep Tabletop on a sub-path (e.g. '/play/table
- [ ] **[H/missing] Four format mode cards (Commander / Draft Commander / Planechase / 20 Life) with enabled/disabled state and Beta/Soon badges**
      vanilla: MODES array (play-shell.js lines 17-22) defines commander (enabled), draft (Draft Commander, beta+disabled ? 'Beta'/'Soon' badge), planechase (disabled ? 'Soon'), standard ('20 Life', disabled). buildModeScreen() (lines 51-62) renders each as a ps-mode-card button with a gradient (--c1/--c2), an arr
      react: No interactive mode cards exist in the play flow. Landing.tsx has a const FORMATS = ['Commander', 'Draft', 'Planechase', '20 Life'] (line 620) but it is decorative marketing text on the landing hero, not selectable cards, has no disabled/Be
      how: In the new PlayEntry.tsx, port the MODES array (key/title/sub/c1/c2/beta/disabled) and render a grid of buttons mirroring ps-mode-card: gradient background from c1/c2, arrow glyph, title + 'Beta'/'Soon' badge, subtitle, disabled+aria-disabled for non-commander modes. onClick for the enabled (command
- [ ] **[M/missing] Player name field (editable text input with default)**
      vanilla: buildModeScreen() renders #psName, a text input with maxlength=24 and placeholder 'Your name' (line 44). It is pre-filled with choice.name or a generated 'Player '+random(100-999) (lines 67-68) and writes back to choice.name on input (line 69), so the name is captured at the entry screen before play
      react: Tabletop.tsx and the play route have no name input. A playerName exists in useAuth (used in Lobby.tsx line 22) but it is not surfaced as an editable field on a play-entry screen, and there is no entry screen to host it. No default 'Player #
      how: Add a controlled <input maxLength={24} placeholder="Your name"> to PlayEntry.tsx, seeded from useAuth().playerName or a generated 'Player ###', persisted into the play choice state (and optionally back into the auth/profile name) before launching the table.
- [ ] **[M/missing] Color swatch that cycles through player colors on click**
      vanilla: buildModeScreen() renders #psSwatch, a button with aria-label 'Change your color' shown next to the name input (line 43). Its background is choice.color (default #4f7bf0, line 15) and clicking it advances through COLORS = 6-color array (line 23) modulo length, updating both choice.color and the swat
      react: No color swatch / color-cycle control exists anywhere in the play-entry flow. Tabletop.tsx renders no such control, and there is no entry screen to host it. The 6-color palette (#4f7bf0, #e0556e, #3fb27f, #d7a13a, #9b5de5, #46c2d8) is not p
      how: In PlayEntry.tsx add a swatch <button aria-label="Change your color"> next to the name input with the COLORS array in state; onClick advance the index modulo COLORS.length and set background. Store the chosen color in the play choice so it can be sent when creating/joining the game.
- [ ] **[M/partial] 'Back to app' exit button that leaves Play and returns to the life-counter tab**
      vanilla: buildModeScreen() renders a ps-topbar with #psExit '? Back to app' (line 39) wired to exitPlay (line 64). exitPlay() (lines 96-100) calls close() (removes play-fs, hides HUD/overlays) and then clicks the life page target ([data-page-target="life"]), returning the user to the life-counter view.
      react: Tabletop.tsx provides only a 'Lobby' link (TabletopSolo lines 338-355, TabletopOnline lines 239-256) that navigates to '/lobby' ? not a 'Back to app' affordance, and not on a mode-select screen (which doesn't exist). There is no equivalent 
      how: On the new PlayEntry.tsx add a top-bar '? Back to app' button that navigates back (e.g. navigate('/life') or navigate(-1)). If full-screen body class handling is added for the entry screen, clear it on exit, mirroring vanilla close()/exitPlay().
- [ ] **[L/missing] Hero tagline and footer copy on the entry screen**
      vanilla: buildModeScreen() renders ps-tag 'A free multiplayer tabletop for Magic: The Gathering' above the name/mode grid (line 41) and ps-foot 'Solo or online ? plays in your browser, nothing to install.' below it (line 47), framing the mode-select choice.
      react: Because there is no React mode-select entry screen, neither the tagline nor the footer copy appears in the play flow. (Similar marketing copy exists on Landing.tsx but that is the marketing landing page, not the in-app Play entry screen.)
      how: Include the ps-tag and ps-foot strings as a header/footer in PlayEntry.tsx around the mode grid to match the vanilla framing copy.

## lobby-deck (7)
- [ ] **[H/missing] Solo / Online toggle in the lobby**
      vanilla: play-shell.js buildLobby() renders a segmented control `#psSeg` with two buttons, Solo (default .active) and Online (lines 131-133). Toggling sets choice.online, shows/hides the join-code row (#psJoin), and is wired at lines 158-165. Solo is the default so the very first action is to pick a deck and
      react: Lobby.tsx has no Solo/Online toggle. Its only tab bar (lines 113-128) switches between 'open' and 'ongoing' SERVER game lists; the whole page is online-only (Supabase `games` query at lines 31-37). Solo play exists only as a separate /play 
      how: Add a Solo/Online segmented control to Lobby.tsx (mirroring the 'open'/'ongoing' tab styling). In Solo mode replace the server game list with the inline deck panel (Sample/saved/import) that navigates to /play with the chosen deck; in Online mode keep the existing games list + create flow.
- [ ] **[H/missing] "Choose Your Deck and Play" inline deck panel CTA**
      vanilla: buildLobby() renders a prominent CTA button `#psChooseDeck` with a book icon, bold label 'Choose Your Deck and Play' and subtitle 'Pick a saved deck or import a decklist, then jump in' (play-shell.js lines 136-138). Clicking it toggles an inline `#psDeckPanel` built by buildDeckPanel() in-place (lin
      react: There is no equivalent CTA or inline deck panel in Lobby.tsx. Deck selection only happens later, inside DraftSelect.tsx via onSelectDeck (handleSelectDeck in DraftRoom.tsx line 215-219) which NAVIGATES AWAY to `/decks?pickFor=<gameId>` ? a 
      how: Add a CTA button + collapsible inline panel to Lobby.tsx (new component e.g. components/lobby/DeckPanel.tsx) containing the sample deck, saved-deck rows, and paste box, matching the vanilla single-screen flow instead of routing to /decks.
- [ ] **[H/partial] Saved decks list with one-click "Play ?"**
      vanilla: buildDeckPanel() pulls saved decks via MTGTable.savedDecks() and renders each as a `.ps-deck-row` with the deck name and 'Play ?'; clicking calls chooseDeck({index:i}) which jumps straight into the game with that deck (play-shell.js lines 216-222, 229-231). Empty state shows a 'No saved decks yet?' 
      react: Decks.tsx lists saved decks (DeckListItem, lines 392-401) but clicking only opens the DeckViewer; there is no per-row 'Play' action. To actually play, the user must arrive via the pickFor flow (banner at lines 421-437) and click 'Use this d
      how: Add a 'Play ?' button to each saved-deck row (in the new lobby DeckPanel, or DeckListItem) that launches a solo game seeded with that deck (extend MockGameLoader / store seeding to accept a chosen SavedDeck instead of always Krenko). Include the 'No saved decks yet' empty-state hint.
- [ ] **[H/partial] Paste Moxfield/Archidekt/MTGA decklist + "Import & Play ?" (one-step import-then-launch)**
      vanilla: buildDeckPanel() renders an inline textarea `#psImport` labeled 'Import from Moxfield / Archidekt / MTGA ? paste a decklist' and an 'Import & Play ?' button `#psImportGo` (play-shell.js lines 225-227). Clicking parses the pasted list and immediately launches a game with it via chooseDeck({paste:t}) 
      react: An import path exists but is two-step and not in the lobby: Decks.tsx ImportDialog (lines 41-162) has a 'Paste List' textarea and importDecklistText() which only SAVES the deck to the library (handleImport lines 303-316) ? it does not launc
      how: Add a paste textarea + 'Import & Play' button to the new lobby DeckPanel that calls importDecklistText() (from lib/decks.ts) and on success immediately routes into a solo /play game seeded with the parsed deck, instead of only persisting it to the library.
- [ ] **[H/missing] Online invite-code field ("Have an invite code? Paste it to join a friend's game") + Join game**
      vanilla: buildLobby() renders a join row `#psJoin` (shown when Online is selected) with a text input `#psJoinCode` placeholder 'Have an invite code? Paste it to join a friend?s game' and a 'Join game' button `#psJoinGo` (play-shell.js line 139). Clicking validates the code and opens the deck panel to take a 
      react: Lobby.tsx has no invite-code paste input and no Join-by-code button ? joining is only possible by clicking a GameCard from the queried list (GameCard.tsx lines 80, 93 navigate to /lobby/<id>). There is also no ?join= deep-link handler in Lo
      how: Add an invite-code input + 'Join game' button to Lobby.tsx (visible in Online mode) that navigates to `/lobby/<code>` after trimming/validating, and handle a `?join=`/`?code=` query param on mount to auto-fill and jump straight in, mirroring openForJoin().
- [ ] **[M/missing] Sample deck (Krenko) selectable from the deck panel**
      vanilla: buildDeckPanel() always lists 'Sample deck (Krenko)' as the first deck row with a 'Play ?' affordance (play-shell.js line 219). Clicking it calls chooseDeck({}) (empty ref) which launches a game with the built-in sample deck immediately (lines 229-231, 239-243).
      react: No Krenko/sample option is exposed in any deck picker. The Krenko Goblins deck exists only as a hardcoded MockGameLoader (components/board/MockGameLoader.tsx, e.g. line 21 'krenko-mob-boss') that auto-seeds the /play solo board ? it is not 
      how: In the new inline DeckPanel (and/or Decks.tsx deck list), add a 'Sample deck (Krenko)' row at the top whose click navigates to /play (solo) which already loads MockGameLoader's Krenko deck, so the user can instantly try it the way vanilla does.
- [ ] **[M/missing] Generate invite link with copy-to-clipboard (online host flow)**
      vanilla: buildLobby() includes a 'Generate invite link' button `#psInviteBtn` that hosts a room and renders a readonly `?join=CODE` link plus a 'Copy link' button (play-shell.js lines 146, 180-204), with graceful messaging when Supabase/sign-in is missing. A separate showInvite() banner also offers 'Copy lin
      react: CreateGameModal.tsx creates a room and immediately redirects to `/lobby/<roomId>` (line 51) without ever surfacing a shareable/copyable invite link or code. DraftRoom.tsx and GameCard.tsx contain no clipboard/copy or invite-link UI (grep fo
      how: After room creation in CreateGameModal.tsx (or in DraftRoom for the host), show the room code/URL with a 'Copy link' button (navigator.clipboard.writeText) so the host can share a join link, matching the vanilla generate-invite + copy behavior.

## playmat-picker (8)
- [ ] **[H/missing] Playmat picker is wired into the lobby ? playmat ? game flow**
      vanilla: play-shell.js buildPlaymat() (lines 247-310) is invoked from the deck-select step (line 241 buildPlaymat(); line 242 show("playmat")) and is a required screen between lobby and game launch.
      react: web/src/components/PlaymatPicker.tsx exists fully built but is never imported or rendered anywhere. Grep for `PlaymatPicker`/`applyMat` across web/src returns only the file itself; Tabletop.tsx (where Nav.tsx line 174 claims the picker 'ope
      how: Import PlaymatPicker into the play/lobby flow (e.g. Tabletop.tsx or the pre-game lobby) and render it as a required step, passing real onSelect/onClose handlers and the current mat id.
- [ ] **[H/missing] MTG art tab ? Scryfall full-art lands (art_crop)**
      vanilla: buildPlaymat showArt() (play-shell.js 272-289) fetches https://api.scryfall.com/cards/search?unique=art&order=released&dir=desc&q=is:fullart type:land, takes data.slice(0,24), reads card.image_uris.art_crop (or card_faces[0].image_uris.art_crop), and builds a swatch with background `url("art_crop") 
      react: PlaymatPicker.tsx has no Scryfall fetch at all. Its three tabs are 'sigil'/'solid'/'url' (line 139, 184). The 'sigil' tab (SIGIL_MATS, lines 109-116) shows brand SVGs plus two hardcoded OpenArt CDN PNGs (AI_MATS, lines 84-97). There is no a
      how: Add an 'MTG art' tab that fetches the Scryfall search URL on first open (cache with state), maps the first 24 results' image_uris.art_crop into PlaymatEntry url mats labeled by card.name, and renders them in the existing grid.
- [ ] **[H/missing] 'Select & Place ?' two-step staging + apply + launch**
      vanilla: Clicking a swatch only stages selection: selectCell sets choice.mat and toggles aria-pressed for single-select (lines 266, 270, 285); the grid does NOT close or apply. A footer button '<button class="ps-mat-go" id="psMatGo">Select &amp; Place ?</button>' (line 260) is the commit action ? on click it
      react: PlaymatPicker.tsx has no footer and no Select & Place button. Clicking any swatch immediately runs `onSelect(mat); onClose()` (line 248), collapsing staging+commit into one click and closing the modal. There is no aria-pressed single-select
      how: Add internal staged-selection state (highlight on click without closing) plus a footer 'Select & Place ?' button that calls onSelect(stagedMat) and triggers the game launch, matching applyPlaymat + launchGame.
- [ ] **[M/missing] Art tab loading / empty / error states**
      vanilla: showArt() renders '<p class="ps-mat-loading">Loading MTG art?</p>' before fetch (line 275), 'No art found.' when data is empty (line 277), and 'Couldn\'t load art.' on fetch failure (line 288 catch).
      react: Because there is no art fetch in PlaymatPicker.tsx, none of these loading/empty/error UI states exist.
      how: When implementing the MTG art tab, add loading/empty/error placeholder rendering mirroring the three vanilla messages.
- [ ] **[M/partial] Upload tab: URL validation + auto place-and-launch**
      vanilla: psMatUrlGo handler (play-shell.js 298-303) validates the URL with /^https?:/i and refocuses the input on failure, builds `url("?") center/cover no-repeat, #111827`, and then auto-clicks psMatGo (Select & Place) so a pasted URL immediately applies and launches the game.
      react: handleUrl in PlaymatPicker.tsx (lines 145-150) only checks `urlVal.trim()` truthiness (no https:// scheme validation, accepts any text), and on Apply calls `onSelect(entry); onClose()` with no launch step and no auto place-and-launch chaini
      how: Validate the input against /^https?:/i (refocus on failure) and route Apply through the same Select & Place commit path so it applies and launches like vanilla.
- [ ] **[L/partial] Tab set and 'Colors' tab semantics**
      vanilla: Tabs are 'Colors' / 'MTG art' / 'Upload' (play-shell.js 255). The default-active 'Colors' tab renders solid swatches sourced dynamically from MTGTable.playmats() (lines 250, 269), each labeled by m.name with background m.css.
      react: PlaymatPicker.tsx tabs are 'Sigil' / 'Solid' / 'URL' (line 184, default tab='sigil' line 142). The solid swatches are a hardcoded SOLID_MATS array of 6 colors (lines 118-125) rather than the host app's MTGTable.playmats() list, and the defa
      how: Default the active tab to the solid/colors tab and source the swatch list from the same data the rest of the app uses (or accept it as a prop) so labels and colors match the vanilla MTGTable.playmats() set.
- [ ] **[L/partial] Back / cancel navigation to lobby**
      vanilla: Both the header ? (psMatX) and footer '? Back' (psMatCancel) call show("lobby") (play-shell.js 304-305), returning the user to the lobby step.
      react: PlaymatPicker.tsx has only a header X that calls onClose (line 199) and a backdrop click ? onClose (line 161). There is no footer '? Back' button, and onClose's meaning (return to lobby vs. just dismiss) is undefined because the component i
      how: Add a footer Back control and ensure close/back handlers navigate to the lobby step in the integrated flow.
- [ ] **[L/partial] Default-selected mat**
      vanilla: buildPlaymat sets choice.mat = mats.length ? mats[0].css : null (line 265), pre-selecting the first swatch so Select & Place always has a value.
      react: PlaymatPicker.tsx accepts a `current` id prop for highlight (line 244) but has no internal default-selected state; with no staging model and immediate apply-on-click, there is no notion of a pre-selected default to commit.
      how: Initialize staged selection to the first available mat (or `current`) when the staging model is added.

## opening-hand (5)
- [ ] **[H/missing] Opening Hand modal shown on game start**
      vanilla: play-shell.js calls openingHand() automatically when a game begins: afterStart() ends with `openingHand();` (line 331) and the wrapped MTGTable.playDeck schedules `setTimeout(function(){ openingHand(); }, 900)` (line 467). openingHand() (line 350) builds/show a fullscreen '.ps-oh' overlay (#psOpenin
      react: Neither Tabletop.tsx (TabletopSolo / TabletopOnline) nor MockGameLoader.tsx render any opening-hand modal. MockGameLoader.init() shuffles and draws 7 (lines 144-147) then immediately calls setGameState/setMySeat (149-150) and returns null (
      how: Add an OpeningHandModal component and render it in Tabletop.tsx (both solo + online inner components) gated by a store flag (e.g. ui.openingHandOpen) set true when MockGameLoader/server seeds the initial 7-card hand. It should overlay the board (position:fixed, high z-index) and require a Keep/Mulli
- [ ] **[H/missing] Grid of 7 readable opening-hand card images**
      vanilla: renderOpeningHand() (play-shell.js line 359-373) reads MTGTable.hand() and renders each card as a large '.ps-oh-card' with <img src=c.img>, falling back to a '.ps-oh-ph' name placeholder, inside a '.ps-oh-cards' grid under the 'Opening Hand' title.
      react: No React component renders a dedicated readable grid of the opening 7. The drawn cards only appear in the normal HandZone (Tabletop.tsx line 232/331) at hand-strip size, not in a large reviewable modal layout. MockGameLoader fetches Scryfal
      how: In the new OpeningHandModal, select the mySeat hand cards from gameStore (cards filtered by zone==='hand') and render each as a large card image using the existing CardMeta.img (same source HandZone uses), with a name placeholder fallback for cards whose image hasn't loaded yet.
- [ ] **[H/missing] Keep hand button that dismisses modal and reveals board**
      vanilla: renderOpeningHand() wires `#psOhKeep` ('? Keep hand') to closeOpeningHand (play-shell.js line 374), which hides the overlay (`ohEl.style.display='none'`, line 384), revealing the board underneath.
      react: There is no Keep-hand control in any React file. Because no modal exists, the board is already visible and there is nothing to dismiss; the deliberate 'review then keep' step is absent.
      how: Add a 'Keep hand' button in the OpeningHandModal whose onClick sets ui.openingHandOpen=false (a store action), unmounting/hiding the overlay so the already-rendered Board/HandZone show through.
- [ ] **[M/partial] Mulligan inside the opening-hand modal (reshuffle + draw 7, then re-render)**
      vanilla: renderOpeningHand wires `#psOhMull` ('? Mulligan') to call MTGTable.mulligan() (play-shell.js line 376), which runs doMulligan() in table.js (line 632): moves hand?library, library_shuffle, draw 7, increments mulliganCount/bottomNeeded; the modal then re-renders the new 7 after 350ms (line 377). Mod
      react: The reshuffle+draw-7 mechanic exists in MulliganButton.tsx handleMulligan() (move hand?library lines 30-32, library_shuffle line 35, draw 7 line 38, mulliganCount++ lines 40-41), but it lives only as a small persistent HUD button ? not insi
      how: Reuse MulliganButton's handleMulligan logic inside the OpeningHandModal (or extract it to a shared hook) so the modal's Mulligan button reshuffles+draws and the modal re-reads the store to display the fresh 7. Include the explanatory note text from play-shell.js line 372.
- [ ] **[L/missing] Image-loading wait state / polling for unloaded card images**
      vanilla: renderOpeningHand shows 'Shuffling your deck?' when the hand is empty and repeatedly re-renders (up to 10 polls, every 500ms) while any card image is still missing (play-shell.js lines 369, 379-382), so the modal fills in card art as Scryfall images arrive.
      react: MockGameLoader has a separate full-screen 'Loading Krenko Goblins?' spinner (Tabletop's MockGameLoader.tsx lines 192-216) that blocks during init, but there is no opening-hand modal and therefore no in-modal wait/poll that progressively rev
      how: In the OpeningHandModal, render a 'Shuffling your deck?' placeholder when hand images are absent and rely on the store's pushImageMeta updates (MockGameLoader line 163) to reactively swap in images ? React re-render replaces the vanilla manual setTimeout polling.

## hud-taskbar (9)
- [ ] **[H/missing] Back to lobby button**
      vanilla: play-hud.js BTNS[0] (lines 44) renders a 'lobby' icon button titled 'Back to lobby' that calls MTGPlayShell.backToLobby() to exit the game back to the lobby/menu.
      react: GameHUD.tsx renders no lobby/exit button anywhere in the taskbar JSX (lines 188-358). There is no navigation back to the lobby from the in-game HUD.
      how: Add an icon button (e.g. lucide ChevronLeft) at the far left of the bar in GameHUD.tsx before the turn pill; onClick navigate to '/lobby' (the app uses react-router; import useNavigate or window.location). Reset/leave the active game state in gameStore as appropriate.
- [ ] **[H/missing] Trackers panel button**
      vanilla: play-hud.js BTNS (line 52) 'track' button opens openTrackers() (lines 192-226): a popup listing per-deck counters (Monarch, City's Blessing, Treasures, Experience, Energy, Commander Tax, Storm, mana counters, etc. from TRACKERS lines 166-173), with toggle/stepper controls, an edit mode to enable/dis
      react: GameHUD.tsx has no trackers button and no trackers popup. PinnedCounter.tsx renders board annotation counter pills but there is no UI to pick/enable trackers, no preset tracker catalog, no toggle trackers, and no add-custom-tracker flow.
      how: Add a 'Trackers' icon button to GameHUD.tsx that opens a new TrackersPanel component porting the TRACKERS catalog, enabled-set persistence, toggle/stepper rows, custom-tracker add, and pin toggle (wiring pins into the existing annotation/PinnedCounter system).
- [ ] **[H/missing] Settings button (Change playmat / Shuffle library / End game)**
      vanilla: play-hud.js BTNS (line 58) 'settings' button opens openSettings() (lines 229-240), a popup with three actions: Change playmat (MTGTable.openPlaymat), Shuffle library (MTGTable.shuffle), and End game (MTGTable.endGame).
      react: GameHUD.tsx has no settings button or settings popup; there is no Change-playmat, Shuffle-library, or End-game control exposed from the HUD.
      how: Add a settings (lucide Settings) icon button in GameHUD.tsx opening a small menu/popover with Shuffle library (dispatch shuffle), End game (end-game flow / return to lobby), and Change playmat (UI setting). Wire to existing engine actions or add them where missing.
- [ ] **[M/partial] Untap-all button**
      vanilla: play-hud.js BTNS (line 46) has a dedicated 'untap' taskbar button titled 'Untap all (u)' that clicks tblUntap to untap all the active player's permanents on demand (also surfaced again as a quick-action qa-untap, lines 248-249).
      react: GameHUD.tsx only fires untap as a side effect inside passTurn() (line 184: dispatch({ t: 'untap_all', seat: nextSeat })). There is no standalone untap button, so a player cannot untap without passing the turn.
      how: Add an icon button in GameHUD.tsx (lucide RotateCcw) in the action group that calls dispatch({ t: 'untap_all', seat: mySeat }) (or activeSeat). The untap_all action already exists in the engine.
- [ ] **[M/partial] Draw button**
      vanilla: play-hud.js BTNS (line 47) has a dedicated 'draw' taskbar button titled 'Draw (d)' that clicks tblDraw to draw a card on demand (also a quick-action qa-draw, line 250).
      react: GameHUD.tsx only draws as a side effect of passTurn() (line 185: dispatch({ t: 'draw', seat: nextSeat, count: 1 })). There is no standalone draw button.
      how: Add an icon button in GameHUD.tsx (lucide BookOpen/draw glyph) calling dispatch({ t: 'draw', seat: mySeat, count: 1 }). The draw action already exists in the engine.
- [ ] **[M/missing] Keywords & help button**
      vanilla: play-hud.js BTNS (line 56) 'help' button titled 'Keywords & help' clicks keywordsButton to open the keywords/help reference overlay.
      react: GameHUD.tsx renders no help/keywords button. (A TermsPanel.tsx exists elsewhere but is not surfaced from the game HUD taskbar.)
      how: Add a 'help' icon button (lucide HelpCircle) in GameHUD.tsx that opens the keywords/terms reference (reuse TermsPanel or a modal driven by web/src/data/terms.ts).
- [ ] **[L/missing] Fullscreen button**
      vanilla: play-hud.js BTNS (line 55) 'full' button calls toggleFullscreen() (lines 35-40) which requests/exits document fullscreen via requestFullscreen/exitFullscreen.
      react: GameHUD.tsx has no fullscreen button; document.fullscreenElement / requestFullscreen is not referenced anywhere in the HUD.
      how: Add an icon button (lucide Maximize/Minimize) in GameHUD.tsx that toggles document.documentElement.requestFullscreen() / document.exitFullscreen(), tracking state via a fullscreenchange listener.
- [ ] **[L/missing] Game stopwatch timer in taskbar**
      vanilla: play-hud.js build() renders a 'hud-turn' block with 'Turn N' plus a live stopwatch '#hudTimer' (lines 65-67), updated every second by startTimer() (lines 78-89) showing elapsed M:SS since game start.
      react: GameHUD.tsx turn pill (lines 207-227) shows 'Turn {turn}' and the phase label but has no elapsed-time stopwatch.
      how: Add a small timer span next to the Turn pill in GameHUD.tsx driven by a setInterval/requestAnimationFrame from game start time, formatted as M:SS.
- [ ] **[L/missing] Rules engine (advisory) toggle button**
      vanilla: play-hud.js BTNS (line 57) 'engine' button titled 'Rules engine (advisory)' calls MTGEngineAssistUI.toggle() to show/hide the advisory rules-engine panel.
      react: GameHUD.tsx exposes no rules-engine toggle button (button not in scope of the named list but present in the vanilla taskbar between help and settings).
      how: If the React app has/needs an advisory engine panel, add a toggle icon button in GameHUD.tsx; otherwise document as intentionally dropped.

## trackers (7)
- [ ] **[H/missing] Trackers popup + taskbar button in the play HUD**
      vanilla: play-hud.js registers a taskbar item `{ ic:"track", t:"Trackers", fn: openTrackers }` (line 52); openTrackers() (lines 192-226) opens a per-deck 'Trackers' popup (subtitle 'Per-deck counters') listing enabled trackers as rows.
      react: GameHUD.tsx top bar (the React port of the play-hud taskbar) has no Trackers button ? its controls are only phase pills, life pills, Mulligan, Pass, Undo, Log toggle, and the Dice popup (GameHUD.tsx lines 256-357). No file opens a per-deck 
      how: Add a 'Trackers' icon button to GameHUD.tsx (next to the Dice button at lines 348-357) that toggles a new TrackersPopup component, mirroring how DicePopup is wired. The popup should render the enabled-tracker list with per-row controls like openTrackers().
- [ ] **[H/partial] Edit-mode catalog grid with filter pills to enable/disable trackers**
      vanilla: openTrackers() edit mode (play-hud.js lines 199-205) renders `allTrackers()` as a `.hud-trk-grid` of `.hud-trk-pill` buttons; tapping a pill toggles its key in the `enabled` array and re-renders (line 204). The 23-tracker catalog is the TRACKERS array (lines 166-173).
      react: No catalog/filter-pill grid exists in the HUD (GameHUD.tsx / PinnedCounter.tsx). The only analog is the standalone LifeTracker.tsx page's per-player picker (lines 359-368: 'Counters ? tap to show/hide', COUNTER_TYPES pills toggling p.visibl
      how: In the new TrackersPopup, add an edit toggle (pencil) that swaps the row list for a pill grid over a TRACKERS catalog ported from play-hud.js lines 166-173, each pill toggling membership in an `enabled` array, matching the vanilla data-en handler.
- [ ] **[H/missing] Persisting enabled trackers to localStorage (mtg_hud_trackers)**
      vanilla: enabled set is loaded from / saved to localStorage key 'mtg_hud_trackers' (loadEnabled/saveEnabled, play-hud.js lines 174-177), with DEFAULT_ON fallback (line 174); every toggle/add calls saveEnabled so the selection survives reloads.
      react: No React tracker selection persists. LifeTracker.tsx's `visible` is plain useState seeded to ['poison'] (makePlayers, lines 59-64) and is reset by newGame() (lines 121-126); the file uses no localStorage at all, so picker choices are lost o
      how: Back the TrackersPopup `enabled` (and `customTrackers`) state with localStorage 'mtg_hud_trackers' via a useEffect or a small useLocalStorage hook, seeded from a DEFAULT_ON list, matching play-hud.js lines 174-177.
- [ ] **[M/missing] Custom 'Add your own tracker' input**
      vanilla: Edit mode includes `<input id="hudTrkNew" maxlength="28"> + Add` (play-hud.js line 202); the Add handler (lines 206-211) derives a key `c_<slug>`, pushes `{k,l,custom:1}` into customTrackers, enables it, and persists ? letting users define arbitrary named trackers.
      react: No React file lets the user add a custom named per-deck/player tracker. LifeTracker.tsx's picker (lines 359-368) only toggles fixed COUNTER_TYPES with no add field. CountersModal.tsx has an 'Add Label' input (lines 202-226) but that dispatc
      how: Add an input+Add button to the TrackersPopup edit view that slugifies the name to `c_<slug>`, appends to a customTrackers list, enables it, and persists to localStorage ? porting play-hud.js lines 206-211.
- [ ] **[M/missing] Toggle-type trackers (on/off) vs counter steppers**
      vanilla: Trackers flagged `toggle:1` (Monarch, City's Blessing, Sol Ring T1, Go Infinite, Tutors, Save Someone, Mass Denial ? TRACKERS lines 167-172) render as an on/off switch row (play-hud.js line 217: `.hud-trk-tog` toggling between 0/1), while non-toggle trackers render a ?/value/+ stepper (line 218).
      react: Neither the HUD nor LifeTracker.tsx supports toggle-style trackers. LifeTracker treats every counter as a numeric stepper (adjustCounter, lines 180-183; chips lines 339-347) and its catalog has monarch/initiative only as numeric counters, w
      how: Carry a `toggle` flag on the ported TRACKERS catalog and render those rows as an on/off switch (set value 0?1) instead of a ? stepper, replicating play-hud.js line 217 vs 218.
- [ ] **[M/partial] Pin-to-board chips + pin persistence (mtg_hud_pins)**
      vanilla: Each tracker row has a pin button (play-hud.js line 216); togglePin (line 189) stores keys in `pinned`, persisted to localStorage 'mtg_hud_pins' (loadPins/savePins, lines 185-186); renderPins/buildPins (lines 285-313) draw pinned trackers as a fixed board-overlay chip strip with ?/value/+ and an unp
      react: PinnedCounter.tsx renders draggable counter pills, but they come from gameState.annotations of kind 'counter' (lines 156-160) created only via Board right-click 'Add counter' (Board.tsx line 353) as blank, value-0, free-position annotations
      how: Add a pin toggle to each TrackersPopup row that stores keys in a `pinned` list persisted to localStorage 'mtg_hud_pins', and render those as a fixed overlay chip strip (label + ?/value/+ + unpin), porting renderPins (play-hud.js lines 299-313) and the hide-when-bar-hidden rule (line 302).
- [ ] **[M/missing] Shared per-deck counter values backing the trackers**
      vanilla: Tracker values are read/written through the shared game store: counters() ? MTGTable.myCounters() and bump() ? MTGTable.addCounter(k,d) (play-hud.js lines 181-182), so both the popup rows and the pinned chips reflect one authoritative per-player counter set.
      react: The table-play game state has no per-player tracker counter map analogous to MTGTable.myCounters ? players in GameHUD carry only `life` (GameHUD.tsx line 293-295, dispatch 'adjust_life'). Counter values in React live either on cards (card.c
      how: Add a per-player `counters: Record<string,number>` to the game/player state with adjust_counter actions in useGameEngine, and have the TrackersPopup rows and pinned chips read/write it, mirroring MTGTable.myCounters/addCounter.

## settings-help (6)
- [ ] **[H/missing] Settings popup (gear button + popup shell) in the play HUD**
      vanilla: play-hud.js BTNS array (line 58) adds a 'settings' gear icon button to the HUD taskbar whose fn is openSettings(). openSettings() (lines 229-240) builds a popup titled 'Settings' / kicker 'Game' via popup() with three rows: 'Change playmat', 'Shuffle library', 'End game'. The life panel also re-open
      react: GameHUD.tsx (the entire top bar, lines 188-360) has NO settings/gear button. The BTNS-equivalent toolbar only has Pass, Undo (line 326), Log toggle (line 335), and Dice (line 349). There is no settings popup component. gameStore.ts declares
      how: Add a gear icon button to the GameHUD toolbar (next to the Dice button around line 357) that toggles a new SettingsPopup component (mirror DicePopup's pattern). The popup should list 'Change playmat', 'Shuffle library', 'End game' rows wired to the three handlers below. Drive open state via the exis
- [ ] **[H/missing] Change playmat during a game**
      vanilla: Settings row '#hudSetMat' onclick calls T.openPlaymat() (play-hud.js line 237), where T = window.MTGTable ? i.e. it re-opens the playmat picker mid-game so the player can swap their mat.
      react: A PlaymatPicker component exists (web/src/components/PlaymatPicker.tsx) but it is only mounted in DeckBuilder.tsx, Ranked.tsx, DraftRoom.tsx, and lobby/DraftSelect.tsx (grep of PlaymatPicker usage). It is NOT rendered by the play screen: Ta
      how: Mount PlaymatPicker inside the play screen (e.g. in PanelShell.tsx) gated by an open flag, and have the Settings popup 'Change playmat' row open it. Use the existing applyMat() export (PlaymatPicker.tsx line 294) and persist the choice; store current-mat state on the Tabletop/board so onSelect re-ap
- [ ] **[H/missing] End game**
      vanilla: Settings row '#hudSetEnd' onclick calls T.endGame() (play-hud.js line 239) ? a user-initiated 'end the current game' action available any time from the HUD settings.
      react: There is no end-game / leave-game action in GameHUD.tsx or the Settings flow (which itself doesn't exist). The only 'end' paths in Tabletop.tsx are the automatic game-over overlay ('Back to Lobby', line 127) and a passive 'Lobby' link on lo
      how: Add an 'End game' row to the Settings popup that ends the active game ? e.g. confirm, then either dispatch a game-end intent (or set the gameOver state used by Tabletop.tsx line 127) and navigate('/lobby'). Reuse the navigate('/lobby') call already present in Tabletop.tsx (line 127).
- [ ] **[H/partial] Keywords & Help button in the play HUD**
      vanilla: play-hud.js BTNS adds a 'help' icon button titled 'Keywords & help' (line 56) whose fn is clickCtrl('keywordsButton') ? opening the keywords/help reference from directly within the play HUD taskbar.
      react: A TermsPanel component (keywords + slang reference) exists and is functional, but it is only mounted inside the global Nav (Nav.tsx imports it line 16, renders it line 327, opened by the 'Keywords & Slang' IconBtn line 259). The global Nav 
      how: Add a help (HelpCircle) icon button to the GameHUD toolbar that toggles TermsPanel. Render TermsPanel from PanelShell.tsx (or GameHUD) with local open state, reusing the same component Nav.tsx already drives (import './TermsPanel', pass open/onClose).
- [ ] **[M/partial] Shuffle library from the Settings popup**
      vanilla: Settings row '#hudSetShuf' onclick calls T.shuffle() (play-hud.js line 238) ? a one-tap 'shuffle my library' action directly from the HUD settings.
      react: The shuffle action itself exists as a reducer intent (library_shuffle) and is reachable via the library pile context menu (PileMenu.tsx line 113/149) and the ZoneViewer (ZoneViewer.tsx line 239/346) and MulliganButton. But there is no HUD-l
      how: In the new Settings popup, add a 'Shuffle library' row that dispatches { t: 'library_shuffle', seat: mySeat } via useGameEngine().dispatch (same call PileMenu.tsx line 113 and ZoneViewer.tsx line 240 already use).
- [ ] **[M/missing] Fullscreen toggle**
      vanilla: play-hud.js BTNS adds a 'full' icon button titled 'Fullscreen' (line 55) calling toggleFullscreen() (lines 35-39), which calls document.documentElement.requestFullscreen() / document.exitFullscreen() based on document.fullscreenElement.
      react: There is no fullscreen affordance anywhere in the React app ? grep for 'fullscreen'/'requestFullscreen' across web/src returns zero matches, and GameHUD.tsx has no such button.
      how: Add a fullscreen (Maximize/Minimize) icon button to GameHUD.tsx's toolbar that calls document.documentElement.requestFullscreen()/document.exitFullscreen(), mirroring vanilla toggleFullscreen (play-hud.js lines 35-39). Optionally track document.fullscreenElement via a fullscreenchange listener to sw

## life-panel (6)
- [ ] **[H/missing] Dedicated top-right self life panel (rich card) vs. row of tiny pills**
      vanilla: play-hud.js buildLife()/updateLife() (lines 253-283) renders a single `.hud-life` card pinned top-right for MY seat only, driven by MTGTable.playerInfo() (table.js line 1661). It is a multi-row card: commander-art background, name + color swatch, big life with ?/+, a 'Commander damage' button, and a
      react: GameHUD.tsx has no equivalent self panel. The '?? Life totals ??' block (lines 291-296) maps players to a generic `LifePill` (lines 114-158) ? an 8px color dot + the life number ? one per seat. There is no rich card, no name, no art, no zon
      how: Add a new self-panel component (e.g. SelfLifePanel) rendered fixed top-right in GameHUD.tsx (or replace the players.map LifePill list). Drive it from useGameStore gameState.players[mySeat] for life/name/counters and from gameState.cards for zone counts. Mirror the vanilla `.hud-life-card` layout.
- [ ] **[H/missing] Library / Graveyard / Exile zone counts (live)**
      vanilla: updateLife() (play-hud.js line 281) renders `<div class='hud-life-zones'>` with Library / Graveyard / Exile counts from playerInfo() (table.js lines 1667-1668: MTGCore.zoneCount for library/graveyard/exile/hand). These refresh every second via the HUD timer, so they track draws/mills/exiles live.
      react: GameHUD.tsx renders no zone counts at all in the life area. The store has the data (gameState.cards: Record<string,CardInstance> with seat+zone; Zone type includes 'library'|'graveyard'|'exile', game.ts lines 47-50) but the HUD never comput
      how: In the self panel, derive counts with Object.values(gameState.cards).filter(c => c.seat===mySeat && c.zone===z).length for z in ['library','graveyard','exile'] (memoize), and render a 3-cell strip like the vanilla `.hud-life-zones`. Reactive store reads keep it live without a timer.
- [ ] **[H/partial] 'Commander damage' button ? full pod commander-damage matrix**
      vanilla: The `.hud-life` panel has a 'Commander damage' button (play-hud.js line 280, data-act='cmddmg') wired to MTGTable.openCommanderDamage() ? openCmdMatrix() (table.js lines 1660, 1426-1462). The matrix is a full pod grid: one row per player showing their life, and a cell per OTHER player with a from-so
      react: GameHUD.tsx / LifePill have no commander-damage entry point at all. A commander-damage capability exists elsewhere (HealthCluster.tsx bottom-left cluster ? TypesModal for applying damage, and CmdrDamageIcons.tsx for per-source icons next to
      how: Add a 'Commander damage' button to the self panel that opens a matrix modal mirroring openCmdMatrix(): iterate gameState.players for rows, render a cell per other seat reading player.cmdDamage[`${fromSeat}:primary`], highlight >=21, and on +/- dispatch the commander_damage + adjust_life reducers (cm
- [ ] **[M/partial] Player name + color swatch label**
      vanilla: updateLife() (play-hud.js line 278) renders `<div class='hud-life-nm'><span class='hud-life-sw' style='background:color'></span>name</div>` ? the player's display name next to a color swatch using playerInfo().color (the player's chosen color, table.js line 1666).
      react: LifePill shows only a color dot + number (GameHUD.tsx lines 141-151); no name text is shown on the pill. The name only appears inside the popover as the generic 'Seat {seat+1} Life' (lines 82-84), and the swatch color comes from a fixed SEA
      how: Render player.name (fallback `Seat ${seat+1}`) beside the swatch in the self panel. If per-player chosen colors are desired, add a `color` field to PlayerState and use it; otherwise keep seatColor() but at least surface the name.
- [ ] **[L/missing] Faint commander art background**
      vanilla: updateLife() (play-hud.js line 275) injects `<div class='hud-life-art' style='background-image:url(commanderArt)'>` when playerInfo().commanderArt is set; playerInfo() (table.js lines 1664-1665) resolves it from the first card in the player's command zone via imagesById. The CSS class fades it as a 
      react: Neither LifePill nor GameHUD references any commander image. There is no lookup of the command-zone card's art; the pill background is a flat 'var(--ink-2)' (line 132).
      how: In the self panel, find the player's command-zone card from gameState.cards (card.seat===mySeat && card.zone==='command'), resolve its image (the store's card image meta / scryfall lib), and render it as a low-opacity absolutely-positioned background div behind the panel content.
- [ ] **[L/partial] Inline single-step life ?/+ on the panel**
      vanilla: The `.hud-life-big` row exposes ? and + buttons directly on the panel (play-hud.js line 279) calling MTGTable.adjustLife(?1) for immediate single-step life changes (handler lines 261-262).
      react: LifePill exposes life adjustment only after opening a popover (GameHUD.tsx lines 88-107) and offers a ?5/?1/+1/+5 grid rather than inline ?1 stepper buttons on the panel itself. (Inline ?1 steppers do exist, but in the separate bottom-left 
      how: Put inline ?1 (and optionally ?5) buttons directly in the self panel's life row, dispatching adjust_life, so the common single-step adjustment needs no popover.

## board-zones (3)
- [ ] **[H/missing] Cannot draw from an opponent's library (ownership guard)**
      vanilla: table.js onPileClick (line 718-722): clicking a Library pile checks `if (seat != null && Number(seat) !== mySeat) { setStatus("You can only draw from your own library."); return; }` and only then dispatches `{ t: 'draw', seat: mySeat, count: 1 }`. Drawing is always for mySeat and blocked on opponent
      react: ZonePile.tsx handleClick (lines 41-52) draws with NO ownership check: `if (zone === 'library' && count > 0 ...) { ... window.MTGCore.reduce(gs, { t: 'draw', seat, count: 1 }) }` where `seat` is the pile's own seat (passed from BoardMat, whi
      how: In web/src/components/board/ZonePile.tsx handleClick, before drawing, read mySeat from the store (useGameStore(s=>s.mySeat)) and guard: `if (seat !== mySeat) { /* optionally set a status toast */ return }`. Route the draw through the same dispatch path other actions use (useGameEngine().dispatch({ t
- [ ] **[M/missing] '0' keyboard shortcut recenters the view**
      vanilla: table.js bindHotkeys (line 1503): `case "0": recenter(); break;` ? pressing 0 recenters/fits the board (recenter() at line 503 fits pods or resets the solo camera).
      react: Board.tsx keyboard handler (lines 113-131) only maps t/f/a and g/e/h/b card moves on the hovered card; it has no '0' case. Recenter is only reachable via double-click on empty background (handleDoubleClick, line 220) or the right-click boar
      how: In Board.tsx onKey, add a branch (outside the hoveredId guard, since recenter is global): `if (e.key === '0') { e.preventDefault(); recenter(); return }`. Place it before the `if (!id) return` early-out so it fires even when no card is hovered.
- [ ] **[L/partial] Zoom scroll clamp range**
      vanilla: table.js wheel handler (line 714) clamps zoom to `Math.max(0.3, Math.min(2.2, camera.z * Math.exp(-e.deltaY * 0.0015)))` ? max zoom 2.2, continuous exponential step from raw deltaY.
      react: Board.tsx handleWheel (lines 190-208) clamps to `Math.min(2.0, Math.max(0.3, c.z * factor))` with a fixed factor of 1.1/0.91 regardless of deltaY magnitude. Max zoom is 2.0 (vanilla 2.2) and the step is fixed rather than proportional to scr
      how: In Board.tsx handleWheel, raise the upper clamp from 2.0 to 2.2 to match vanilla, and optionally replace the fixed 1.1/0.91 factor with `Math.exp(-e.deltaY * 0.0015)` so the step scales with scroll delta like table.js line 714.

## hand-hover-preview (6)
- [ ] **[H/missing] Exploded hover preview panel (large aspect-correct card image on card hover)**
      vanilla: Hovering ANY card fires the node mouseenter listener (table.js:605) which calls showPreview(c) (table.js:629). showPreview writes a full-size <img> of the card into the right-rail #tblPreview panel (index.html:311, .tbl-preview is a 280px-tall flex-centered box, table.css:67-68 with `img { max-width
      react: There is NO preview panel anywhere in the React play tab. CardNode.onPointerEnter/Leave only call setHoveredCard (CardNode.tsx:219-220), and the only consumer of ui.hoveredCardId is the keyboard-hotkey effect in Board.tsx:118 ? it never ren
      how: Add a preview-panel component (e.g. web/src/components/board/PreviewPanel.tsx) that subscribes to useGameStore(s=>s.ui.hoveredCardId), looks up gameState.cards[id] + imagesById[card.cardId], and renders the image at full aspect (object-fit:contain / max-width:100% max-height:100%) in a fixed side ra
- [ ] **[M/missing] Hand-card hover also drives the preview**
      vanilla: cardNode(c, inHand) attaches the same mouseenter->showPreview listener to every card regardless of zone (table.js:587,605), so hovering a HAND card populates the preview panel just like a board card.
      react: CardNode guards the hover handlers with `if (context === 'board')` (CardNode.tsx:219-220), so hand cards never call setHoveredCard. Even after a preview panel is added (gap above), hand-card hover would still show nothing.
      how: Remove the `context === 'board'` guard on onPointerEnter/onPointerLeave in CardNode.tsx:219-220 (or call setHoveredCard for hand too), so hand hover feeds the same hoveredCardId the preview panel reads. Keep board-only behaviors (hotkeys) keyed off zone separately if needed.
- [ ] **[L/missing] Token badge inside the preview**
      vanilla: showPreview appends `<span class="prev-token">Token</span>` when the hovered card is a non-face-down token (table.js:629), styled as a yellow 'TOKEN' pill in the preview (table.css:132).
      react: No preview exists, so there is no token marker in any preview surface. (CardNode shows a small 'T' badge on the card itself at CardNode.tsx:279-290, but not in an exploded preview.)
      how: When building the preview panel, render a 'TOKEN' pill overlay when card.isToken && !card.faceDown, matching .tbl-preview .prev-token (table.css:132).
- [ ] **[L/missing] Click the preview to open full card inspect**
      vanilla: The preview panel has cursor:zoom-in and a click handler that calls openInspect(previewCard) to open the full-card inspect overlay (table.js:62).
      react: No preview panel exists, so there is no click-to-inspect from a preview. React's inspect/zoom equivalents are only the DeckBuilder modal (DeckBuilder.tsx:447) which is a different screen.
      how: On the new preview panel, set cursor:zoom-in and onClick open a full-card overlay for the hovered card (port vanilla openInspect, table.js:618-627), or reuse an existing card-zoom modal if one is added.
- [ ] **[L/partial] Hand hover gesture: gentle zoom + lift + straighten fan rotation**
      vanilla: .tbl-hand .tbl-card:hover { transform: translateY(-32px) scale(1.08) rotate(0deg) !important; z-index:60 } (table.css:289) ? on hover the card lifts 32px, zooms ~1.08x, and straightens to rotate(0) out of its fan tilt.
      react: CardNode hand hover is `whileHover={{ scale: 1.12, y: -8 }}` (CardNode.tsx:228). Zoom is present (1.12 ? gentle), but the lift is only 8px vs vanilla 32px, and whileHover does NOT reset rotate ? the fan rotation is driven by `animate.rotate
      how: In CardNode.tsx:228 increase the hand-hover lift (y: -32 to match) and add rotate:0 to the hand whileHover so the hovered card straightens like .tbl-hand .tbl-card:hover (table.css:289). Ensure the rotate override wins over the animate fanRot (whileHover takes precedence in framer-motion).
- [ ] **[L/partial] Drag-from-hand reverts the dragged card to normal (un-zoomed) size**
      vanilla: handDrag creates a SEPARATE ghost element (makeGhost, table.js:672) of class .tbl-ghost sized 90x126 with opacity .85 (table.css:103) that follows the cursor at normal/un-zoomed size, while the original hand card stays in the fan (gets the no-op .hand-dragging class, table.js:679). So the thing unde
      react: React has no separate ghost; it repositions the ACTUAL CardNode as position:fixed at the cursor (CardNode.tsx:231-233) at base width 88, with animate rotate->0 and y->0 (CardNode.tsx:223-224). It never explicitly resets scale to 1, and the 
      how: While handGhost is active, force scale:1 in the animate prop (or disable whileHover) so the dragged card is normal size like vanilla .tbl-ghost; optionally render a separate fixed ghost and keep a dimmed placeholder in the fan to match vanilla's makeGhost/.hand-dragging behavior (table.js:672,679).

## rightclick-hotkeys (16)
- [ ] **[H/missing] Hotkey X ? make a token copy of hovered card**
      vanilla: table.js bindHotkeys() case "x" (line 1496): dispatch({ t: "card_clone", fromId: c.instanceId, instanceId: "tok"+tokenSeq++, x:45, y:60 }) ? clones the hovered card preserving its art/PT.
      react: Board.tsx onKey handler (lines 113-131) only handles t/f/a and the moves map {g,e,h,b}. There is no case for 'x'. The on-screen hint (Board.tsx line 375) also omits X. No global keydown handler elsewhere covers it (only Board.tsx reads ui.h
      how: In Board.tsx onKey, add `else if (k === 'x') { e.preventDefault(); const seq = useGameStore.getState().bumpTokenSeq(); dispatch({ t:'card_clone', fromId:id, instanceId:`tok-${seq}`, x:45, y:60 }) }` (use the same clone/token_create path as CardMenu.tokenCopy).
- [ ] **[H/missing] Hotkey I ? inspect hovered card**
      vanilla: table.js case "i" (line 1501): if (c) openInspect(c) ? opens the card inspector for the hovered card.
      react: Board.tsx onKey has no 'i' branch. The store has openInspect (used by CardMenu.inspectCard, CardMenu.tsx line 241) but it is never wired to a keypress on the hovered card.
      how: In Board.tsx onKey add `else if (k === 'i') { e.preventDefault(); useGameStore.getState().openInspect(id) }`.
- [ ] **[H/missing] Hotkey D ? draw a card (global)**
      vanilla: table.js case "d" (line 1498): dispatch({ t:"draw", seat: mySeat, count: 1 }) ? fires regardless of hover.
      react: Board.tsx onKey returns early when there is no hoveredCardId (lines 118-119: `if (!id) return`), so even if a 'd' case existed it could never fire without a hovered card. There is no global draw hotkey; draw only exists as a HUD button.
      how: Add a global branch in onKey BEFORE the `if (!id) return` guard: `if (k === 'd') { e.preventDefault(); dispatch({ t:'draw', seat: useGameStore.getState().mySeat, count:1 }); return }` (and similarly for u/z/0).
- [ ] **[H/missing] Hotkey U ? untap all (global)**
      vanilla: table.js case "u" (line 1499): dispatch({ t:"untap_all", seat: mySeat }).
      react: Board.tsx onKey has no 'u' branch and is gated behind the hovered-card guard. untap_all exists in the engine (useGameEngine.ts line 72) and as a HUD/pass-turn action, but no U hotkey.
      how: Add global branch (before hover guard): `if (k === 'u') { e.preventDefault(); dispatch({ t:'untap_all', seat: useGameStore.getState().mySeat }); return }`.
- [ ] **[H/missing] Hotkey Z ? undo (global)**
      vanilla: table.js case "z" (line 1500): undo().
      react: Board.tsx onKey has no 'z' branch and is gated behind the hovered-card guard, so undo is not bound to a key anywhere in the play tab.
      how: Add a global branch in onKey calling the engine/store undo (whatever undo facility useGameEngine exposes): `if (k === 'z') { e.preventDefault(); /* undo() */; return }`.
- [ ] **[M/missing] Hotkeys L (library top) and P (play from hand)**
      vanilla: table.js case "l" (line 1494): card_move toZone library pos minPos-1 (top); case "p" (line 1497): if hovered card is in hand, playFromHand(c) -> move to battlefield.
      react: Board.tsx onKey moves map is only { g, e, h, b } (line 123); there is no 'l' (library top) and no 'p' (play from hand). Compounded by the hover gap below, P could not work on hand cards even if added.
      how: Extend the moves map with `l: 'library'` (passing pos:'top') and add a 'p' branch that, when the hovered card.zone === 'hand', dispatches card_move to battlefield with random x/y like CardNode.handleDoubleClick.
- [ ] **[M/partial] Hotkeys only act on hovered BATTLEFIELD cards, never hand cards**
      vanilla: table.js sets hoveredId on every card node's mouseenter (line 605, in the shared card render), so hotkeys (H return-to-hand, P play, T, etc.) work while hovering a hand card too.
      react: CardNode.tsx only sets hoveredCardId for board cards: onPointerEnter `if (context === 'board') setHoveredCard(card.instanceId)` (line 219). Hovering a hand card never populates ui.hoveredCardId, so Board.tsx hotkeys are dead over the hand.
      how: In CardNode.tsx set hovered for hand context too (or a separate hand-hover field) and let Board.tsx onKey dispatch hand-appropriate actions (H/P) when the hovered card.zone === 'hand'.
- [ ] **[M/missing] Hotkey ? ? hotkey help overlay**
      vanilla: table.js case "?" (line 1502) calls showHotkeyHelp() (line 1139) which renders a full cheat-sheet overlay listing every hovered-card and global hotkey (T/F/A/G/E/H/L/B/X/P, D/U/Z/0/Esc).
      react: No '?' handler in Board.tsx and no HotkeyHelp component exists (grep for showHotkeyHelp/HotkeyHelp returns nothing in web/src). The only discoverability is the small static hint string at Board.tsx line 375, which lists just T/F/A/G/E/H/B.
      how: Add a HotkeyHelp overlay component and a '?' branch in Board.tsx onKey to toggle it; mirror the row list from table.js showHotkeyHelp().
- [ ] **[M/partial] Right-click 'Create token copy' (X) preserves source art/PT**
      vanilla: table.js menu item "Create token copy" (line 763) and hotkey X dispatch card_clone with fromId ? the engine clones the source card so the token keeps its image, P/T and identity.
      react: CardMenu.tsx tokenCopy() (lines 236-239) dispatches token_create with name `${card.name} Token` and NO cardId/image meta, so the copy is a blank-named token without the original art or P/T ? not a true clone of the hovered card.
      how: Use a card_clone action (fromId: cardId) like vanilla, or in tokenCopy copy the source's cardId/image meta and pushImageMeta for the new instance so the token renders with the original art.
- [ ] **[M/partial] Create-token popup: 'Tokens only' toggle to search all cards**
      vanilla: openCreateToken() (table.js lines 828-882) has a 'Tokens only' checkbox + filter button; when unchecked, doSearch() drops the is:token filter (line 868: `term + ' is:token'` vs plain `term`), letting you search any card to spawn as a token.
      react: TokenModal.tsx run() always prepends the filter: `const q = `is:token ${term}`` (line 27). There is no checkbox/filter toggle, so non-token cards can never be searched/spawned.
      how: Add a 'Tokens only' checkbox state in TokenModal and conditionally build the query (`term` vs `is:token ${term}`), mirroring vanilla's cb.checked logic.
- [ ] **[M/partial] Create-token popup: stay open with per-row quantity (add multiple token types)**
      vanilla: openCreateToken addRow() (table.js lines 849-864) gives every result row its own ?/N/+ stepper and a Create button that spawns and shows '? Added' WITHOUT closing (line 861), so you can add several different tokens in one session.
      react: TokenModal.tsx uses a single global qty (line 17) and spawn() calls onClose() after creating (line 41), so the modal closes after one token and you cannot queue multiple distinct tokens or set per-row counts.
      how: Remove onClose() from spawn (keep the modal open with a transient 'Added' confirmation), and move qty to a per-row stepper as in vanilla addRow.
- [ ] **[L/partial] Hotkey B target zone differs from vanilla**
      vanilla: table.js case "b" (line 1495) moves hovered card to library (bottom); showHotkeyHelp() documents B = "Put on bottom of library" and L = top (lines 1144-1145).
      react: Board.tsx moves map (line 123) maps `b: 'battlefield'`, i.e. B returns the card to the battlefield rather than sending it to the bottom of the library. This silently changes the meaning of the B hotkey vs. vanilla.
      how: Decide on parity: change moves['b'] to 'library' (bottom) to match vanilla's hotkey/help, and use 'l' for library-top ? or keep current mapping intentionally and update the on-screen hint to avoid confusion.
- [ ] **[L/partial] Hotkey 0 ? recenter; Esc ? close menus/cancel**
      vanilla: table.js case "0" (line 1503) recenter(); case "escape" (line 1504) removes pile overlays, closeMenu, closePile, closeCounters, clearLink, clearSelection.
      react: Board.tsx onKey has no '0' branch (recenter is only via background double-click, line 220-225). Escape is handled per-component (CardMenu.tsx line 216, HandMenu, PileMenu) but there is no single global Escape that also clears arrows/highlig
      how: Add a global '0' branch calling recenter(), and a global Escape branch that closes any open menu and clears arrows/highlight/targeting/attach state (clearArrows, clearHighlighted, cancelTargeting/attaching).
- [ ] **[L/partial] Create-token popup: live debounced search-as-you-type**
      vanilla: openCreateToken (table.js line 848): `q.addEventListener('input', () => { clearTimeout(t0); t0 = setTimeout(doSearch, 280) })` ? results update ~280ms after typing, and it auto-loads is:token on open (doSearch at line 880).
      react: TokenModal.tsx only searches on form submit (line 53 onSubmit) or quick-chip click; typing in the input (line 56 onChange just setQuery) does not trigger a search, and the modal shows an empty 'Search for a token?' state until you submit.
      how: Add a debounced effect on `query` that calls run(query), and run an initial is:token search when the modal opens, to match vanilla's live behavior.
- [ ] **[L/missing] Create-token popup: hover zoom preview of token art**
      vanilla: openCreateToken showTokZoom/hideTokZoom (table.js lines 841-842, 863) shows a large zoomed image of a token thumbnail on hover/click.
      react: TokenModal.tsx result tiles only show a '+qty' overlay on hover (line 80); there is no enlarged preview of the token art.
      how: Add a hover-zoom layer (fixed large image) in TokenModal triggered on result-tile mouseenter, like vanilla's tok-zoom.
- [ ] **[L/partial] Right-click menu: zone-move items as top-level entries with chips vs nested submenu**
      vanilla: openMenu (table.js lines 750-760) renders Move to hand/battlefield/graveyard/command as TOP-LEVEL items each with a key chip (H/B/G/C), reordering for commanders (line 754), plus a 'More zones?' submenu for Exile/Library top/bottom.
      react: CardMenu.tsx nests all zone moves inside a single 'Move to' submenu (lines 327-348) with chips H/B/G/C/(none) ? there are no top-level Move-to-graveyard/hand chips, and no commander-specific reordering (commander only adds a 'Commander tax 
      how: Optionally surface graveyard/hand/battlefield/command as top-level chipped items (and reorder command-first for commanders) to match vanilla's one-click muscle memory, keeping Exile/Library in a sub-list.

## action-log (5)
- [ ] **[H/missing] Phase-change log entry ("<name> moved to Main 1")**
      vanilla: table.js describe() has a `set_phase` case (lines 1572-1577) that resolves the active player's display name and renders `<b>{who}</b> moved to <b>{Main 1|Untap|Upkeep|...}</b>`. Because dispatch() calls `log(describe(action))` for every action (line 344), each phase advance produces this readout ? t
      react: web/src/components/hud/GameHUD.tsx:176-177 dispatches `{ t: 'set_phase', phase: p }` through the same useGameEngine dispatch, but describeAction() in web/src/hooks/useGameEngine.ts:245-273 has NO `set_phase` case, so it returns '' (default,
      how: Add a `set_phase` case to describeAction() in web/src/hooks/useGameEngine.ts mirroring the vanilla phase-label map ({untap:'Untap',upkeep:'Upkeep',draw:'Draw',main1:'Main 1',combat:'Combat',main2:'Main 2',end:'End',cleanup:'Cleanup'}); resolve the active player's name from `state.players[state.activ
- [ ] **[M/partial] Generic fallback so EVERY dispatched action logs something**
      vanilla: table.js describe() ends with `default: return "<b>" + esc(a.t) + "</b>";` (line 1582). Combined with `log(describe(action))` on every dispatch (line 344), every reducer action ? even ones with no bespoke wording ? produces at least a generic log row.
      react: describeAction() (useGameEngine.ts:245-273) returns '' for any unrecognized `a.t`, and dispatch() only pushes when `desc` is truthy (useGameEngine.ts:191). So actions with no explicit case are silently dropped from the log. Vanilla cases ab
      how: Change describeAction()'s default branch from `return ''` to `return "<b>" + esc(String(a.t)) + "</b>"` (matching vanilla line 1582), and add the missing cases ? card_phase (`<b>Phase</b> {name}`), card_attach (`<b>Attach</b> {name}`), card_clone (`<b>Token copy</b> of {name}`) ? so equipment/aura a
- [ ] **[M/partial] Pass-turn readout ("<name> took the turn")**
      vanilla: table.js describe() `pass_turn` case (lines 1578-1581) reads the POST-pass `state.activeSeat` and renders `<b>{player.name || Seat N}</b> took the turn`. The action itself is dispatched bare as `{ t: 'pass_turn' }` (table.js:1654, table-core.js:221 derives the next seat).
      react: describeAction() (useGameEngine.ts:265-266) returns `<b>Pass turn</b> ? seat ${a.toSeat}`. The pass_turn action carries no `toSeat` property (it is computed inside the reducer), so this renders "seat undefined"; it also shows a raw seat num
      how: In describeAction()'s pass_turn case, resolve the new active player from the post-reduce state (pass the reduced `next` state, or recompute `(activeSeat+1)%seats`) and render `<b>{player.name||Seat N}</b> took the turn`, matching vanilla.
- [ ] **[L/partial] Player name resolution in life / counter log entries**
      vanilla: Vanilla resolves player display names for player-scoped entries (set_phase and pass_turn use `players[seat].name`). Life/counter lines themselves are terse (`<b>Life</b> +N`, `<b>{kind}</b> +N`) without a seat index.
      react: describeAction() renders `Player ${a.seat} life ${delta}` (adjust_life, useGameEngine.ts:263-264) and `Player ${a.seat} ${delta} ${kind}` (player_counter, lines 259-260) using the raw numeric seat index instead of the player's name. Inconsi
      how: Resolve `state.players[a.seat]?.name` (fallback `Seat N` / `You` for mySeat) in the adjust_life and player_counter cases of describeAction() rather than emitting the bare `Player {index}` string.
- [ ] **[L/partial] Action-label wording on move / tap log lines**
      vanilla: table.js describe() prefixes a bold verb label: `<b>Move</b> {name} ? {zone}` (line 1560) and `<b>Tap/Untap</b> {name}` (line 1561).
      react: describeAction() emits `${name} ? ${a.toZone}` with no "Move" label (useGameEngine.ts:248-249) and `${name} tapped/untapped` instead of the leading `<b>Tap/Untap</b>` label (line 250-251). Functionally equivalent but the readout wording div
      how: Optional cosmetic alignment: prefix the bold verb (`<b>Move</b> `, `<b>Tap/Untap</b> `) in the card_move and card_tap cases of describeAction() to match table.js wording.
