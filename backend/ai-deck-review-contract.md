# AI Deck Review Backend Contract

The web and iOS clients should call a private backend endpoint for deck coaching. Do not call an AI provider directly from browser JavaScript or an iOS app with a public key.

## Endpoint

`POST /api/deck-review`

Auth: Supabase user JWT in `Authorization: Bearer <token>`.

## Request

```json
{
  "deckId": "uuid",
  "format": "commander",
  "goals": ["casual", "budget"],
  "privacyMode": true,
  "deck": {
    "name": "New Commander Deck",
    "commanderName": "Commander Name",
    "bracket": 3,
    "cards": [
      {
        "quantity": 1,
        "section": "mainboard",
        "name": "Sol Ring",
        "typeLine": "Artifact",
        "manaCost": "{1}",
        "manaValue": 1,
        "oracleText": "{T}: Add {C}{C}."
      }
    ]
  }
}
```

## Response

```json
{
  "summary": "This deck has a strong low-cost engine but needs more reliable card draw.",
  "score": 7,
  "strengths": ["Efficient ramp", "Clear commander synergy"],
  "risks": ["Low removal count", "High three-mana concentration"],
  "suggestedCuts": [
    { "name": "Example Cut", "reason": "Low synergy with the commander." }
  ],
  "suggestedAdds": [
    { "name": "Example Add", "reason": "Improves early consistency." }
  ],
  "manaCurveNotes": "Curve is playable but crowded at three mana.",
  "tableTrackerCounters": ["storm", "treasure"]
}
```

## Persistence

After a successful review:

1. Insert a row into `ai_deck_reviews`.
2. Store the original normalized request in `prompt`.
3. Store the model output in `response`.
4. Keep status as `complete`.

Failed reviews should store `status = 'failed'` and a short user-safe error string.

## Privacy

Only send deck content and user-provided goals. Never send email addresses, auth tokens, device ids, payment data, or unrelated profile settings.
