import Foundation

enum CounterKey: String, Codable, CaseIterable, Identifiable {
    case poison
    case infect
    case energy
    case commander
    case experience
    case storm
    case treasure
    case clue
    case food
    case blood
    case map
    case rad
    case shield
    case oil
    case charge
    case loyalty
    case tax
    case monarch
    case initiative

    var id: String { rawValue }

    var label: String {
        switch self {
        case .commander: return "Commander damage"
        case .infect: return "Infect"
        case .experience: return "XP"
        case .tax: return "Cmdr tax"
        default: return rawValue.capitalized
        }
    }
}

struct PlayerState: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var seatIndex: Int
    var name: String
    var life: Int
    var colorIndex: Int
    var commanderName: String?
    var commanderArtURL: URL?
    var counters: [CounterKey: Int]
    var visibleCounterKeys: [CounterKey]
    var isDead: Bool
    var deathReason: String?
    var commanderDamageDeathRestoreLife: Int?
    var infectDeathRestoreLife: Int?

    static func make(index: Int, startingLife: Int) -> PlayerState {
        PlayerState(
            seatIndex: index,
            name: "Player \(index + 1)",
            life: startingLife,
            colorIndex: index,
            counters: Dictionary(uniqueKeysWithValues: CounterKey.allCases.map { ($0, 0) }),
            visibleCounterKeys: [.tax],
            isDead: false
        )
    }
}

struct GameState: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var name: String = "Commander table"
    var startingLife: Int = 40
    var layout: String = "auto"
    var totalTurns: Int = 0
    var turnCycle: Int = 0
    var turnTrackingEnabled: Bool = true
    var activeSeatIndex: Int = 0
    var commanderDamageTaken: [String: [String: Int]] = [:]
    var version: Int = 1
    var players: [PlayerState] = (0..<4).map { PlayerState.make(index: $0, startingLife: 40) }
    var updatedAt: Date = Date()

    init() {}

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case startingLife
        case layout
        case totalTurns
        case turnCycle
        case turnTrackingEnabled
        case activeSeatIndex
        case commanderDamageTaken
        case version
        case players
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Commander table"
        startingLife = try container.decodeIfPresent(Int.self, forKey: .startingLife) ?? 40
        layout = try container.decodeIfPresent(String.self, forKey: .layout) ?? "auto"
        totalTurns = try container.decodeIfPresent(Int.self, forKey: .totalTurns) ?? 0
        turnCycle = try container.decodeIfPresent(Int.self, forKey: .turnCycle) ?? 0
        turnTrackingEnabled = try container.decodeIfPresent(Bool.self, forKey: .turnTrackingEnabled) ?? true
        activeSeatIndex = try container.decodeIfPresent(Int.self, forKey: .activeSeatIndex) ?? 0
        commanderDamageTaken = try container.decodeIfPresent([String: [String: Int]].self, forKey: .commanderDamageTaken) ?? [:]
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        players = try container.decodeIfPresent([PlayerState].self, forKey: .players) ?? (0..<4).map { PlayerState.make(index: $0, startingLife: startingLife) }
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
    }
}

enum GameActionType: String, Codable {
    case lifeChange = "life_change"
    case counterChange = "counter_change"
    case commanderDamageChange = "commander_damage_change"
    case commanderTaxChange = "commander_tax_change"
    case turnCycleChange = "turn_cycle_change"
    case diceRoll = "dice_roll"
    case coinFlip = "coin_flip"
    case randomPlayer = "random_player"
    case playerUpdate = "player_update"
    case tableReset = "table_reset"
    case undo
    case redo

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        if let action = GameActionType(rawValue: value) {
            self = action
            return
        }

        switch value {
        case "lifeChange": self = .lifeChange
        case "counterChange": self = .counterChange
        case "commanderDamageChange": self = .commanderDamageChange
        case "commanderTaxChange": self = .commanderTaxChange
        case "turnCycleChange": self = .turnCycleChange
        case "diceRoll": self = .diceRoll
        case "coinFlip": self = .coinFlip
        case "randomPlayer": self = .randomPlayer
        case "playerUpdate": self = .playerUpdate
        case "tableReset": self = .tableReset
        default:
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown game action type: \(value)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct QueuedAction: Identifiable, Codable {
    var id: UUID = UUID()
    var gameId: UUID
    var type: GameActionType
    var payload: [String: String]
    var clientActionId: String = UUID().uuidString
    var createdAt: Date = Date()

    init(
        id: UUID = UUID(),
        gameId: UUID,
        type: GameActionType,
        payload: [String: String],
        clientActionId: String = UUID().uuidString,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.gameId = gameId
        self.type = type
        self.payload = payload
        self.clientActionId = clientActionId
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case gameId
        case type
        case payload
        case clientActionId
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        gameId = try container.decode(UUID.self, forKey: .gameId)
        type = try container.decode(GameActionType.self, forKey: .type)
        payload = try container.decodeIfPresent([String: String].self, forKey: .payload) ?? [:]
        clientActionId = try container.decodeIfPresent(String.self, forKey: .clientActionId) ?? id.uuidString
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
    }
}
