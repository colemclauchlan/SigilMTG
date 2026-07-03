import SwiftUI

struct PlayerCardView: View {
    @EnvironmentObject private var appState: AppState
    let player: PlayerState
    @State private var showingCounters = false
    @State private var showingCommanderDamage = false

    var body: some View {
        ZStack {
            commanderBackground

            VStack(spacing: 10) {
                HStack {
                    Text(player.name)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    Button("Counters") {
                        showingCounters.toggle()
                    }
                    .font(.caption.bold())
                }

                HStack(spacing: 12) {
                    lifeButton(label: "-", delta: -1)
                    Text("\(player.life)")
                        .font(.system(size: 72, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.55)
                        .frame(maxWidth: .infinity)
                    lifeButton(label: "+", delta: 1)
                }

                Button {
                    showingCommanderDamage = true
                } label: {
                    Label("Commander Damage", systemImage: "shield.lefthalf.filled")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan.opacity(0.82))

                visibleCounters
            }
            .padding()

            if player.isDead {
                DeathOverlay(reason: player.deathReason ?? "You are dead!")
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(.cyan.opacity(0.45), lineWidth: 1)
        )
        .sheet(isPresented: $showingCounters) {
            CounterPickerSheet(player: player)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingCommanderDamage) {
            CommanderDamageSheet(defender: player)
                .presentationDetents([.medium, .large])
        }
    }

    private var commanderBackground: some View {
        ZStack {
            if let url = player.commanderArtURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(red: 0.05, green: 0.09, blue: 0.14)
                }
            } else {
                Color(red: 0.05, green: 0.09, blue: 0.14)
            }
            LinearGradient(colors: [.black.opacity(0.45), .black.opacity(0.2), .black.opacity(0.7)], startPoint: .top, endPoint: .bottom)
        }
    }

    private func lifeButton(label: String, delta: Int) -> some View {
        Button {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.72)) {
                appState.changeLife(playerId: player.id, delta: delta)
            }
        } label: {
            Text(label)
                .font(.system(size: 42, weight: .black))
                .frame(width: 64, height: 118)
        }
        .buttonStyle(.borderedProminent)
        .tint(delta > 0 ? .green.opacity(0.75) : .red.opacity(0.75))
    }

    private var visibleCounters: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(player.visibleCounterKeys.filter { $0 != .commander }) { key in
                CounterRow(player: player, key: key)
            }
        }
    }
}

struct CommanderDamageSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    let defender: PlayerState

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 150), spacing: 12)]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(appState.commanderSources()) { source in
                        CommanderDamageTile(defender: defender, source: source)
                    }
                }
                .padding()
            }
            .navigationTitle("Commander Damage")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct CommanderDamageTile: View {
    @EnvironmentObject private var appState: AppState
    let defender: PlayerState
    let source: CommanderDamageSource

    private var damage: Int {
        appState.commanderDamage(defenderId: defender.id, commanderId: source.id)
    }

    var body: some View {
        VStack(spacing: 8) {
            ZStack(alignment: .bottomLeading) {
                if let url = source.artURL {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Color(red: 0.05, green: 0.09, blue: 0.14)
                    }
                } else {
                    Color(red: 0.05, green: 0.09, blue: 0.14)
                    Text(source.name.prefix(2).uppercased())
                        .font(.largeTitle.bold())
                        .foregroundStyle(.cyan)
                }

                LinearGradient(colors: [.clear, .black.opacity(0.78)], startPoint: .center, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 2) {
                    Text(source.name)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Text(source.ownerName)
                        .font(.caption2.bold())
                        .foregroundStyle(.cyan)
                }
                .padding(8)
            }
            .frame(height: 178)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            Text("\(damage)")
                .font(.system(size: 38, weight: .black, design: .rounded))
                .monospacedDigit()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
                .background(damage >= 21 ? .red.opacity(0.5) : .black.opacity(0.42), in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 8) {
                Button("-") {
                    appState.changeCommanderDamage(defenderId: defender.id, commanderId: source.id, delta: -1)
                }
                .tint(.red.opacity(0.78))

                Button("+") {
                    appState.changeCommanderDamage(defenderId: defender.id, commanderId: source.id, delta: 1)
                }
                .tint(.green.opacity(0.78))
            }
            .buttonStyle(.borderedProminent)
            .font(.title3.bold())
        }
        .padding(8)
        .background(.black.opacity(0.36), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(damage >= 21 ? .red.opacity(0.8) : .cyan.opacity(0.35), lineWidth: 1)
        )
    }
}

struct CounterRow: View {
    @EnvironmentObject private var appState: AppState
    let player: PlayerState
    let key: CounterKey

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(key.label.uppercased())
                .font(.caption2.bold())
                .foregroundStyle(.cyan)
            HStack {
                Button("-") { appState.changeCounter(playerId: player.id, key: key, delta: -1) }
                Spacer()
                Text("\(player.counters[key] ?? 0)")
                    .font(.headline.monospacedDigit())
                Spacer()
                Button("+") { appState.changeCounter(playerId: player.id, key: key, delta: 1) }
            }
            .buttonStyle(.bordered)
        }
        .padding(8)
        .background(.black.opacity(0.38), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct DeathOverlay: View {
    let reason: String

    var body: some View {
        ZStack {
            Color.red.opacity(0.82)
            VStack(spacing: 8) {
                Text("\u{2620}")
                    .font(.system(size: 96))
                Text("You are dead!")
                    .font(.title.bold())
                Text(reason)
                    .font(.caption.bold())
            }
            .foregroundStyle(.white)
        }
    }
}
