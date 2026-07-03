import SwiftUI

struct DeckBuilderView: View {
    @EnvironmentObject private var appState: AppState
    @State private var deck = SavedDeck()
    @State private var query = ""
    @State private var format = "commander"
    @State private var colorIdentity = ""
    @State private var sort = "name"
    @State private var results: [ScryfallCardSearchResult] = []
    @State private var suggestions: [String] = []
    @State private var isSearching = false
    @State private var message = "Search Scryfall to start building."

    private let scryfall = ScryfallService()

    var body: some View {
        List {
            Section {
                TextField("Deck name", text: $deck.name)
                Picker("Format", selection: $deck.format) {
                    ForEach(["commander", "standard", "modern", "pioneer", "legacy", "vintage"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
                LabeledContent("AI bracket") {
                    Text(deck.bracket.map { "Bracket \($0)" } ?? "Review needed")
                        .foregroundStyle(.blue)
                        .fontWeight(.semibold)
                }
                Button("Review deck") {
                    reviewDeck()
                }
                TextField("Notes", text: $deck.notes, axis: .vertical)
            } header: {
                Text("Active deck")
            }

            Section {
                TextField("Search cards", text: $query)
                    .textInputAutocapitalization(.words)
                    .onSubmit { Task { await search() } }
                    .onChange(of: query) { value in
                        Task { await autocomplete(value) }
                    }

                HStack {
                    Picker("Format", selection: $format) {
                        ForEach(["commander", "standard", "modern", "pioneer", "legacy", "vintage", ""], id: \.self) {
                            Text($0.isEmpty ? "Any" : $0.capitalized).tag($0)
                        }
                    }
                    TextField("Color ID", text: $colorIdentity)
                        .textInputAutocapitalization(.never)
                    Picker("Sort", selection: $sort) {
                        ForEach(["name", "edhrec", "released", "cmc"], id: \.self) {
                            Text($0.capitalized).tag($0)
                        }
                    }
                }

                Button(isSearching ? "Searching..." : "Search Scryfall") {
                    Task { await search() }
                }
                .disabled(isSearching)

                if !suggestions.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(suggestions.prefix(8), id: \.self) { suggestion in
                                Button(suggestion) {
                                    query = suggestion
                                    Task { await search() }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                }

                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } header: {
                Text("Scryfall")
            }

            Section {
                ForEach(results) { card in
                    CardSearchRow(card: card) {
                        add(card, to: .mainboard)
                    } setCommander: {
                        add(card, to: .commander)
                    }
                }
            } header: {
                Text("Results")
            }

            Section {
                DeckStatsRow(deck: deck)
                ForEach(DeckCardSection.allCases) { section in
                    let entries = deck.cards.filter { $0.section == section }
                    if !entries.isEmpty {
                        SectionHeader(section: section, count: entries.reduce(0) { $0 + $1.quantity })
                        ForEach(entries) { entry in
                            DeckEntryRow(entry: entry) {
                                changeQuantity(entry, delta: -1)
                            } increment: {
                                changeQuantity(entry, delta: 1)
                            }
                        }
                    }
                }
            } header: {
                Text("Deck list")
            }
        }
        .navigationTitle("Deck Builder")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Import") {
                    importToTable()
                }
            }
        }
    }

    private func autocomplete(_ value: String) async {
        do {
            suggestions = try await scryfall.autocomplete(query: value)
        } catch {
            suggestions = []
        }
    }

    private func search() async {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isSearching = true
        defer { isSearching = false }
        do {
            results = try await scryfall.search(query: query, format: format, colorIdentity: colorIdentity, sort: sort)
            message = "\(results.count) card(s) found."
        } catch {
            message = "Could not search Scryfall."
        }
    }

    private func add(_ card: ScryfallCardSearchResult, to section: DeckCardSection) {
        if let index = deck.cards.firstIndex(where: { $0.card.name == card.name && $0.section == section }) {
            deck.cards[index].quantity += 1
        } else {
            deck.cards.append(DeckEntry(quantity: 1, section: section, card: card.deckSnapshot))
        }

        if section == .commander {
            deck.commanderName = card.name
            deck.commanderScryfallId = card.id
            deck.commanderArtURL = card.imageURL
        }
    }

    private func changeQuantity(_ entry: DeckEntry, delta: Int) {
        guard let index = deck.cards.firstIndex(where: { $0.id == entry.id }) else { return }
        deck.cards[index].quantity += delta
        if deck.cards[index].quantity <= 0 {
            deck.cards.remove(at: index)
        }
    }

    private func importToTable() {
        guard !deck.cards.isEmpty else {
            message = "Add cards before importing this deck."
            return
        }
        appState.importDeckToFirstPlayer(deck)
        message = "\(deck.name) imported to the table."
    }

    private func reviewDeck() {
        guard !deck.cards.isEmpty else {
            message = "Add cards before asking for a bracket review."
            return
        }

        let normalizedNames = Set(deck.cards.map { $0.card.name.lowercased() })
        let gameChangers = [
            "ancient tomb", "cyclonic rift", "demonic tutor", "fierce guardianship",
            "force of will", "mana crypt", "mystic remora", "rhystic study",
            "smothering tithe", "the one ring", "thassa's oracle", "underworld breach",
            "vampiric tutor"
        ].filter { normalizedNames.contains($0) }
        let fullText = deck.cards.map { "\($0.card.name) \($0.card.oracleText)" }.joined(separator: " ").lowercased()

        var bracket = deck.totalCount < 60 ? 1 : 2
        if !gameChangers.isEmpty { bracket = max(bracket, min(4, 2 + gameChangers.count)) }
        if deck.totalCount >= 95 && deck.averageManaValue < 3.5 { bracket = max(bracket, 3) }
        if gameChangers.count > 3 { bracket = max(bracket, 4) }
        if fullText.contains("thassa's oracle") && (fullText.contains("demonic consultation") || fullText.contains("tainted pact")) {
            bracket = 5
        }

        deck.bracket = bracket
        message = "AI assigned Bracket \(bracket). Add more ramp, draw, and interaction suggestions based on the web review catalog."
    }
}

private struct CardSearchRow: View {
    let card: ScryfallCardSearchResult
    let add: () -> Void
    let setCommander: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AsyncImage(url: card.imageURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(.thinMaterial)
            }
            .frame(width: 64, height: 90)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(card.name).font(.headline)
                Text(card.typeLine).font(.caption).foregroundStyle(.secondary)
                Text(card.oracleText).font(.caption2).lineLimit(3)
                HStack {
                    Button("Add", action: add).buttonStyle(.borderedProminent)
                    Button("Commander", action: setCommander).buttonStyle(.bordered)
                }
            }
        }
    }
}

private struct DeckStatsRow: View {
    let deck: SavedDeck

    var body: some View {
        HStack {
            Stat(label: "Cards", value: "\(deck.totalCount)")
            Stat(label: "Lands", value: "\(deck.landCount)")
            Stat(label: "Avg mana", value: deck.averageManaValue.formatted(.number.precision(.fractionLength(2))))
        }
    }
}

private struct Stat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading) {
            Text(value).font(.headline)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SectionHeader: View {
    let section: DeckCardSection
    let count: Int

    var body: some View {
        Text("\(section.rawValue.capitalized) (\(count))")
            .font(.caption)
            .fontWeight(.bold)
            .foregroundStyle(.blue)
    }
}

private struct DeckEntryRow: View {
    let entry: DeckEntry
    let decrement: () -> Void
    let increment: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("\(entry.quantity)x \(entry.card.name)").font(.subheadline).fontWeight(.semibold)
                Text(entry.card.typeLine).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("-", action: decrement)
            Button("+", action: increment)
        }
    }
}

#Preview {
    NavigationStack {
        DeckBuilderView()
    }
    .environmentObject(AppState())
}
