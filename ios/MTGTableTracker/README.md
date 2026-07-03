# MTGTableTracker iOS

SwiftUI scaffold for the native iOS version of Magic Table Tracker.

## Included

- Native SwiftUI app entry point
- Game/player/counter models
- Local cache via `UserDefaults`
- Offline queue model
- Haptic service
- Table/player/counter/dice UI
- Death overlay
- Supabase sync service boundary
- Info.plist with orientation and backend placeholders
- Asset catalog with copied logo as AppIcon placeholder

## Required In Xcode

1. Create/open an Xcode iOS project.
2. Add all files in `MTGTableTracker/`.
3. Add package:

```text
https://github.com/supabase/supabase-swift
```

4. Replace `SyncService` TODOs with real `SupabaseClient` calls:
   - auth session restore
   - email sign in/sign up
   - Google OAuth
   - Apple OAuth
   - game upserts
   - realtime subscriptions
   - offline queue flush
5. Add tests for `AppState` life/counter/death behavior.

## Future Android

The shared Supabase schema and `shared/data-contract.md` are platform neutral. Android should reuse:

- table state model
- action log model
- conflict rules
- death rules
- counter keys
