# Magic Table Tracker Shared Data Contract

This document defines the common model used by the web app, iOS app, and future Android app.

## Platform Assumptions

- Backend: Supabase Auth + Postgres + Realtime.
- Sync model: local-first clients write actions optimistically, then upsert state and append a `game_actions` row.
- Conflict handling: game rows use a monotonically increasing `version`. If a client writes over a newer version, it pulls latest state, replays queued local actions, then writes a new version.
- Offline support: clients keep recent games and queued actions locally. On reconnect, queued actions are submitted in original client order using `client_action_id` for idempotency.

## Core Entities

### Profile

```json
{
  "id": "uuid",
  "displayName": "Planeswalker",
  "avatarUrl": null,
  "defaultStartingLife": 40,
  "preferredLayout": "auto",
  "theme": "dark"
}
```

### Game

```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "name": "Commander table",
  "status": "active",
  "startingLife": 40,
  "layout": "auto",
  "totalTurns": 0,
  "turnCycle": 1,
  "turnTrackingEnabled": true,
  "activeSeatIndex": 0,
  "version": 1,
  "participants": [],
  "actions": []
}
```

### Participant

```json
{
  "id": "uuid",
  "gameId": "uuid",
  "seatIndex": 0,
  "displayName": "Player 1",
  "lifeTotal": 40,
  "colorIndex": 0,
  "commanderName": null,
  "commanderScryfallId": null,
  "commanderArtUrl": null,
  "commanderTax": 0,
  "commanderDamageTaken": {
    "sourceParticipantId-or-commanderId": 0
  },
  "visibleCounterKeys": ["tax"],
  "deckSource": null,
  "deckCards": [],
  "isDead": false,
  "deathReason": null
}
```

### Counter

```json
{
  "participantId": "uuid",
  "counterKey": "poison",
  "label": "Poison",
  "value": 0
}
```

Default counter keys:

- `tax`

Supported smart/optional counter keys:

- `poison`
- `infect`
- `energy`
- `experience`
- `storm`
- `treasure`
- `clue`
- `food`
- `blood`
- `map`
- `rad`
- `shield`
- `oil`
- `charge`
- `loyalty`
- `monarch`
- `initiative`

### Game Action

```json
{
  "id": "uuid",
  "gameId": "uuid",
  "actorId": "uuid",
  "actionType": "life_change",
  "payload": {
    "participantId": "uuid",
    "delta": -1,
    "previousValue": 40,
    "nextValue": 39
  },
  "clientActionId": "ios-device-uuid:000001",
  "clientCreatedAt": "2026-06-17T00:00:00Z"
}
```

## Death Rules

The app should mark a player dead when:

- `lifeTotal <= 0`
- `poison >= 10`
- `infect >= 10`
- any one commander damage source reaches `>= 21`

Commander damage is source-aware. Do not sum commander damage from multiple commanders for the death check:

```json
{
  "commanderDamageTaken": {
    "defendingParticipantId": {
      "attackingCommanderId": 17,
      "partnerCommanderId": 9
    }
  }
}
```

The player may remain visible with a death overlay until the table resets.

## Realtime Channels

Clients subscribe to:

- `games:id=eq.<gameId>`
- `game_participants:game_id=eq.<gameId>`
- `game_counters:game_id=eq.<gameId>`
- `commander_damage:game_id=eq.<gameId>`
- `game_actions:game_id=eq.<gameId>`
- `dice_rolls:game_id=eq.<gameId>`

## Undo/Redo

Undo and redo are action-based:

- Append an `undo` action that references the original action id.
- Apply inverse local state immediately.
- Keep original actions; do not delete history.

## Dice And Coin

Dice/coin events are stored in `dice_rolls` and also appended to `game_actions` for history. Results are generated on the client for responsiveness and persisted for cross-device visibility.

## Deck Builder

The deck builder is shared by web, iOS, and future Android clients. Scryfall card data is cached in `card_cache`; user-owned deck state lives in `saved_decks` and `deck_cards`.

### Saved Deck

```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "name": "Dimir Spells",
  "format": "commander",
  "commanderName": "Talion, the Kindly Lord",
  "commanderScryfallId": "uuid",
  "commanderArtUrl": "https://...",
  "bracket": 3,
  "powerLevel": 7,
  "tags": ["control", "faeries"],
  "notes": "Needs more ramp.",
  "isFavorite": false,
  "version": 1,
  "cards": []
}
```

### Deck Card

```json
{
  "deckId": "uuid",
  "scryfallId": "uuid",
  "section": "mainboard",
  "quantity": 1,
  "cardName": "Sol Ring",
  "cardSnapshot": {
    "name": "Sol Ring",
    "type_line": "Artifact",
    "mana_cost": "{1}",
    "cmc": 1,
    "color_identity": [],
    "image_uris": {}
  },
  "tags": [],
  "notes": ""
}
```

Supported sections:

- `commander`
- `mainboard`
- `sideboard`
- `maybeboard`

### Deck Validation

Clients should compute instant local warnings and the backend may re-check on save:

- Commander decks should have exactly 100 total cards including commander.
- Commander decks should have 1 commander card unless partner/background rules are added later.
- Commander decks are singleton except basic lands and cards that explicitly override deckbuilding limits.
- Constructed 60-card formats should have at least 60 mainboard cards and no more than 4 copies of most non-basic cards.
- Card legality should use the Scryfall `legalities` field for the selected format.
- Color identity should be checked against the selected commander for Commander decks.

### AI Deck Review Contract

AI review requests are stored in `ai_deck_reviews` and should be served by a private backend endpoint, not directly from a public browser key.

Request payload:

```json
{
  "deckId": "uuid",
  "format": "commander",
  "goals": ["casual", "budget"],
  "deck": {
    "name": "Dimir Spells",
    "commanderName": "Talion, the Kindly Lord",
    "cards": []
  }
}
```

Expected response:

```json
{
  "summary": "Short review for the player.",
  "score": 7,
  "strengths": ["Good interaction density."],
  "risks": ["Low ramp count."],
  "suggestedCuts": [{"name": "Card Name", "reason": "Too slow."}],
  "suggestedAdds": [{"name": "Card Name", "reason": "Improves draw."}],
  "manaCurveNotes": "Curve is concentrated at three mana.",
  "tableTrackerCounters": ["storm", "treasure"]
}
```

Privacy rule: send only deck/card content and user-supplied goals to the AI endpoint. Do not include auth tokens, email addresses, device ids, or unrelated profile data.
