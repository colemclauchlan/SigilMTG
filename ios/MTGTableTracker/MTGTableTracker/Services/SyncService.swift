import Foundation

// Add https://github.com/supabase/supabase-swift in Xcode and replace the placeholder
// implementation with real SupabaseClient calls. The API boundary is ready for that.
actor SyncService {
    private let store = LocalStore()
    private(set) var isSignedIn = false

    func bootstrap() async -> String {
        guard SupabaseEnvironment.isConfigured else {
            return "Local mode"
        }

        // TODO: Initialize SupabaseClient here after adding the Swift package:
        // let client = SupabaseClient(
        //   supabaseURL: URL(string: SupabaseEnvironment.url)!,
        //   supabaseKey: SupabaseEnvironment.anonKey
        // )
        return "Supabase configured; add supabase-swift in Xcode to enable live sync"
    }

    func queue(game: GameState, type: GameActionType, payload: [String: String]) async {
        let action = QueuedAction(gameId: game.id, type: type, payload: payload)
        var queue = store.loadQueue()
        queue.append(action)
        store.saveQueue(queue)

        if isSignedIn {
            await flushQueue()
        }
    }

    func flushQueue() async {
        guard isSignedIn else { return }
        // TODO: Upsert queued actions into public.game_actions, then remove successful actions.
    }
}

enum SupabaseEnvironment {
    static var url: String {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
    }

    static var anonKey: String {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
    }

    static var isConfigured: Bool {
        !url.isEmpty && !anonKey.isEmpty && !url.contains("your-project")
    }
}
