# Play tab — 2‑minute test checklist

Open the app, click the **Play** tab, and walk this. For anything that fails, tell me the step number + what you saw and I'll fix + screenshot‑verify it.

## 1. Mode select
- [ ] Header/logo bar is **gone**, screen is full‑screen
- [ ] You see the logo, a name field (pre‑filled), a color swatch, and 4 mode cards (Commander / Draft Commander / Planechase / 20 Life)
- [ ] Color swatch cycles colors on click; name field is editable
- [ ] "‹ Back to app" (top‑left) returns to the Life counter (header comes back)

## 2. Lobby
- [ ] Clicking a mode card opens the lobby (mode name shown top‑left)
- [ ] **Solo / Online** toggle works; choosing **Online** reveals a "Join with code" row
- [ ] "Choose Your Deck and Play" expands a panel with **Sample deck (Krenko)** + your **saved decks** + a paste‑a‑decklist box
- [ ] "‹ Modes" returns to mode select

## 3. Deck → playmat → game
- [ ] Clicking a deck (try **Sample deck (Krenko)** first) opens the **playmat picker**
- [ ] Selecting a playmat tile highlights it; "Select & Place" launches the game
- [ ] Game is **full‑screen**, board fills the screen, hand fans along the bottom
- [ ] **Opening Hand** screen shows your 7 cards with **Keep hand / Mulligan** (card images may take a second to load)

## 4. In‑game HUD
- [ ] Top **windows‑bar**: turn · phases (one lit) · life ±  · WUBRGC mana · counters
- [ ] Floating **"‹ Lobby"** (top‑left) and **"✚ Counters"** (top‑right) buttons
- [ ] "✚ Counters" opens the quick‑add tracker; +/- buttons change counters
- [ ] **Right‑click** a card / pile → all the old menus still work
- [ ] "‹ Lobby" returns to the lobby

## 5. Import + online (optional)
- [ ] Paste a Moxfield/Archidekt decklist in the lobby's import box → "Import & Play" loads it
- [ ] Online → launch hosts a game and shows an **invite pill** (code + Copy link) on the board

---
**Most likely failure points** (where blind‑built code tends to break): a saved deck not loading, the board not filling, or images not appearing in the opening hand. If you hit one, that's exactly the kind of runtime bug I can fix fast once you point at it.
