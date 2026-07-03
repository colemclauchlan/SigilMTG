import SwiftUI

struct DiceToolbar: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Button("Random player") {
                    if let player = appState.game.players.randomElement() {
                        appState.lastRoll = "\(player.name) plays first"
                    }
                }
                Spacer()
                Text(appState.lastRoll)
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            }

            HStack {
                Button("D6") { appState.rollDie(sides: 6) }
                Button("D12") { appState.rollDie(sides: 12) }
                Button("D20") { appState.rollDie(sides: 20) }
                Button("Coin") { appState.flipCoin() }
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
