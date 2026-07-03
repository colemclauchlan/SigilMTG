import Foundation

final class LocalStore {
    private let gameKey = "recent-game"
    private let queueKey = "offline-queue"

    func loadRecentGame() -> GameState? {
        guard let data = UserDefaults.standard.data(forKey: gameKey) else { return nil }
        return try? JSONDecoder().decode(GameState.self, from: data)
    }

    func save(_ game: GameState) {
        guard let data = try? JSONEncoder().encode(game) else { return }
        UserDefaults.standard.set(data, forKey: gameKey)
    }

    func loadQueue() -> [QueuedAction] {
        guard let data = UserDefaults.standard.data(forKey: queueKey) else { return [] }
        return (try? JSONDecoder().decode([QueuedAction].self, from: data)) ?? []
    }

    func saveQueue(_ actions: [QueuedAction]) {
        guard let data = try? JSONEncoder().encode(actions) else { return }
        UserDefaults.standard.set(data, forKey: queueKey)
    }
}
