import Foundation
import SwiftUI

struct CommanderDamageSource: Identifiable, Equatable {
    var id: String
    var ownerPlayerId: UUID
    var ownerName: String
    var name: String
    var artURL: URL?
    var colorIndex: Int
}

@MainActor
final class AppState: ObservableObject {
    @Published var game = GameState()
    @Published var isSignedIn = false
    @Published var syncStatus = "Local mode"
    @Published var isOffline = false
    @Published var lastRoll = "Roll"

    private let store = LocalStore()
    private let sync = SyncService()
    private let haptics = HapticsService()

    func bootstrap() async {
        game = store.loadRecentGame() ?? GameState()
        syncStatus = await sync.bootstrap()
        isSignedIn = await sync.isSignedIn
    }

    func changeLife(playerId: UUID, delta: Int) {
        guard let index = game.players.firstIndex(where: { $0.id == playerId }) else { return }
        let previousLife = game.players[index].life
        game.players[index].life = max(0, previousLife + delta)
        applyDeathRules(playerIndex: index)
        game.version += 1
        game.updatedAt = Date()
        store.save(game)
        haptics.life(delta: delta)
        Task {
            await sync.queue(game: game, type: .lifeChange, payload: [
                "participantId": playerId.uuidString,
                "delta": "\(delta)",
                "previousValue": "\(previousLife)",
                "nextValue": "\(game.players[index].life)"
            ])
        }
    }

    func changeCounter(playerId: UUID, key: CounterKey, delta: Int) {
        guard let index = game.players.firstIndex(where: { $0.id == playerId }) else { return }
        let previousCounter = game.players[index].counters[key] ?? 0
        let previousLife = game.players[index].life
        let next = max(0, previousCounter + delta)
        game.players[index].counters[key] = next

        if key == .infect {
            if previousCounter < 10 && next >= 10 {
                game.players[index].infectDeathRestoreLife = previousLife
            } else if delta < 0, previousCounter >= 10, next < 10, let restoreLife = game.players[index].infectDeathRestoreLife {
                game.players[index].life = max(0, restoreLife)
                game.players[index].infectDeathRestoreLife = nil
            }
        }

        applyDeathRules(playerIndex: index)
        game.version += 1
        game.updatedAt = Date()
        store.save(game)
        haptics.selection()
        Task {
            await sync.queue(game: game, type: .counterChange, payload: [
                "participantId": playerId.uuidString,
                "counterKey": key.rawValue,
                "delta": "\(delta)",
                "previousValue": "\(previousCounter)",
                "nextValue": "\(game.players[index].counters[key] ?? 0)"
            ])
        }
    }

    func toggleCounter(playerId: UUID, key: CounterKey) {
        guard let index = game.players.firstIndex(where: { $0.id == playerId }) else { return }
        if game.players[index].visibleCounterKeys.contains(key) {
            if key != .tax {
                game.players[index].visibleCounterKeys.removeAll { $0 == key }
            }
        } else {
            game.players[index].visibleCounterKeys.append(key)
        }
        store.save(game)
    }

    func rollDie(sides: Int) {
        let result = Int.random(in: 1...sides)
        lastRoll = "D\(sides): \(result)"
        haptics.major()
        Task { await sync.queue(game: game, type: .diceRoll, payload: ["kind": "d\(sides)", "result": "\(result)"]) }
    }

    func flipCoin() {
        let result = Bool.random() ? "Heads" : "Tails"
        lastRoll = "Coin: \(result)"
        haptics.major()
        Task { await sync.queue(game: game, type: .coinFlip, payload: ["kind": "coin", "result": result]) }
    }

    func resetGame() {
        game.players = game.players.indices.map { PlayerState.make(index: $0, startingLife: game.startingLife) }
        game.commanderDamageTaken = [:]
        game.totalTurns = 0
        game.turnCycle = 0
        game.activeSeatIndex = 0
        game.version += 1
        game.updatedAt = Date()
        store.save(game)
        haptics.major()
        Task { await sync.queue(game: game, type: .tableReset, payload: [:]) }
    }

    func importDeckToFirstPlayer(_ deck: SavedDeck) {
        guard game.players.indices.contains(0) else { return }
        let commander = deck.cards.first { $0.section == .commander }?.card
        let commanderName = deck.commanderName ?? commander?.name

        if let commanderName = commanderName {
            game.players[0].name = commanderName
            game.players[0].commanderName = commanderName
        }
        game.players[0].commanderArtURL = deck.commanderArtURL ?? commander?.imageURL
        game.players[0].visibleCounterKeys = smartCounters(for: deck)
        game.version += 1
        game.updatedAt = Date()
        store.save(game)
        haptics.major()
        Task {
            await sync.queue(
                game: game,
                type: .playerUpdate,
                payload: ["participantId": game.players[0].id.uuidString, "deckId": deck.id.uuidString]
            )
        }
    }

    private func smartCounters(for deck: SavedDeck) -> [CounterKey] {
        var counters: Set<CounterKey> = [.tax]
        let text = deck.cards
            .map { "\($0.card.name) \($0.card.typeLine) \($0.card.oracleText)" }
            .joined(separator: " ")
            .lowercased()

        let matches: [(CounterKey, [String])] = [
            (.poison, ["poison", "toxic", "corrupted"]),
            (.infect, ["infect"]),
            (.energy, ["energy"]),
            (.experience, ["experience counter"]),
            (.storm, ["storm", "magecraft", "copy target instant", "copy target sorcery"]),
            (.treasure, ["treasure token"]),
            (.clue, ["clue token", "investigate"]),
            (.food, ["food token"]),
            (.blood, ["blood token"]),
            (.map, ["map token"]),
            (.rad, ["rad counter"]),
            (.shield, ["shield counter"]),
            (.oil, ["oil counter"]),
            (.charge, ["charge counter"]),
            (.loyalty, ["planeswalker", "loyalty counter"]),
            (.monarch, ["become the monarch", "you are the monarch"]),
            (.initiative, ["take the initiative", "you have the initiative"])
        ]

        for (key, words) in matches where words.contains(where: { text.contains($0) }) {
            counters.insert(key)
        }

        return CounterKey.allCases.filter { counters.contains($0) }
    }

    func commanderSources() -> [CommanderDamageSource] {
        game.players.map { player in
            let name = player.commanderName ?? player.name
            return CommanderDamageSource(
                id: "\(player.id.uuidString):primary",
                ownerPlayerId: player.id,
                ownerName: player.name,
                name: name,
                artURL: player.commanderArtURL,
                colorIndex: player.colorIndex
            )
        }
    }

    func commanderDamage(defenderId: UUID, commanderId: String) -> Int {
        game.commanderDamageTaken[defenderId.uuidString]?[commanderId] ?? 0
    }

    func changeCommanderDamage(defenderId: UUID, commanderId: String, delta: Int) {
        guard let index = game.players.firstIndex(where: { $0.id == defenderId }) else { return }
        let previousDamage = commanderDamage(defenderId: defenderId, commanderId: commanderId)
        let nextDamage = max(0, previousDamage + delta)
        let actualDelta = nextDamage - previousDamage
        guard actualDelta != 0 else { return }

        let previousLife = game.players[index].life
        var defenderMap = game.commanderDamageTaken[defenderId.uuidString] ?? [:]
        defenderMap[commanderId] = nextDamage
        game.commanderDamageTaken[defenderId.uuidString] = defenderMap

        if actualDelta > 0 {
            if previousDamage < 21, nextDamage >= 21 {
                game.players[index].commanderDamageDeathRestoreLife = previousLife
            }
            game.players[index].life = max(0, previousLife - actualDelta)
            haptics.life(delta: -actualDelta)
        } else {
            let removedDamage = abs(actualDelta)
            if previousDamage >= 21, nextDamage < 21, let restoreLife = game.players[index].commanderDamageDeathRestoreLife {
                game.players[index].life = max(0, restoreLife)
                game.players[index].commanderDamageDeathRestoreLife = nil
            } else {
                game.players[index].life += removedDamage
            }
            haptics.life(delta: removedDamage)
        }

        applyDeathRules(playerIndex: index)
        game.version += 1
        game.updatedAt = Date()
        store.save(game)
        Task {
            await sync.queue(game: game, type: .commanderDamageChange, payload: [
                "participantId": defenderId.uuidString,
                "commanderId": commanderId,
                "delta": "\(actualDelta)",
                "previousValue": "\(previousDamage)",
                "nextValue": "\(nextDamage)"
            ])
        }
    }

    private func lethalCommanderDamage(for player: PlayerState) -> (commanderId: String, damage: Int)? {
        let damageMap = game.commanderDamageTaken[player.id.uuidString] ?? [:]
        guard let entry = damageMap.first(where: { $0.value >= 21 }) else { return nil }
        return (commanderId: entry.key, damage: entry.value)
    }

    private func applyDeathRules(playerIndex: Int) {
        let player = game.players[playerIndex]
        if let lethalCommander = lethalCommanderDamage(for: player) {
            let commanderName = commanderSources().first(where: { $0.id == lethalCommander.commanderId })?.name ?? "one commander"
            game.players[playerIndex].life = 0
            game.players[playerIndex].isDead = true
            game.players[playerIndex].deathReason = "21 commander damage from \(commanderName)."
        } else if (player.counters[.infect] ?? 0) >= 10 {
            game.players[playerIndex].life = 0
            game.players[playerIndex].isDead = true
            game.players[playerIndex].deathReason = "10 infect counters."
        } else if player.life <= 0 {
            game.players[playerIndex].isDead = true
            game.players[playerIndex].deathReason = "Life total reached 0."
        } else if (player.counters[.poison] ?? 0) >= 10 {
            game.players[playerIndex].isDead = true
            game.players[playerIndex].deathReason = "10 poison counters."
        } else {
            game.players[playerIndex].isDead = false
            game.players[playerIndex].deathReason = nil
            game.players[playerIndex].commanderDamageDeathRestoreLife = nil
            game.players[playerIndex].infectDeathRestoreLife = nil
        }
    }
}
