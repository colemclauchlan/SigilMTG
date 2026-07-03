import Foundation

enum DeckCardSection: String, Codable, CaseIterable, Identifiable {
    case commander
    case mainboard
    case sideboard
    case maybeboard

    var id: String { rawValue }
}

struct DeckCardSnapshot: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var typeLine: String
    var oracleText: String
    var manaCost: String
    var manaValue: Double
    var colorIdentity: [String]
    var imageURL: URL?
}

struct DeckEntry: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var quantity: Int
    var section: DeckCardSection
    var card: DeckCardSnapshot
    var tags: [String] = []
    var notes: String = ""
}

struct SavedDeck: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var name: String = "New Commander Deck"
    var format: String = "commander"
    var commanderName: String?
    var commanderScryfallId: UUID?
    var commanderArtURL: URL?
    var bracket: Int?
    var powerLevel: Double = 7
    var tags: [String] = []
    var notes: String = ""
    var isFavorite: Bool = false
    var version: Int = 1
    var cards: [DeckEntry] = []
    var updatedAt: Date = Date()

    var activeCards: [DeckEntry] {
        cards.filter { $0.section != .maybeboard && $0.section != .sideboard }
    }

    var totalCount: Int {
        activeCards.reduce(0) { $0 + $1.quantity }
    }

    var landCount: Int {
        activeCards.reduce(0) { total, entry in
            total + (entry.card.typeLine.localizedCaseInsensitiveContains("land") ? entry.quantity : 0)
        }
    }

    var averageManaValue: Double {
        let nonLands = activeCards.filter { !$0.card.typeLine.localizedCaseInsensitiveContains("land") }
        let quantity = nonLands.reduce(0) { $0 + $1.quantity }
        guard quantity > 0 else { return 0 }
        let total = nonLands.reduce(0) { $0 + ($1.card.manaValue * Double($1.quantity)) }
        return total / Double(quantity)
    }
}

struct ScryfallCardSearchResult: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var typeLine: String
    var oracleText: String
    var manaCost: String
    var manaValue: Double
    var colorIdentity: [String]
    var imageURL: URL?

    var deckSnapshot: DeckCardSnapshot {
        DeckCardSnapshot(
            id: id,
            name: name,
            typeLine: typeLine,
            oracleText: oracleText,
            manaCost: manaCost,
            manaValue: manaValue,
            colorIdentity: colorIdentity,
            imageURL: imageURL
        )
    }
}
