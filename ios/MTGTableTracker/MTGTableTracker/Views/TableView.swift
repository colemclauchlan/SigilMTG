import SwiftUI

struct TableView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var columns: [GridItem] {
        let count = horizontalSizeClass == .compact ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: 12), count: count)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                DiceToolbar()
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(appState.game.players) { player in
                        PlayerCardView(player: player)
                    }
                }
            }
            .padding()
        }
        .background(
            LinearGradient(colors: [.black, Color(red: 0.03, green: 0.08, blue: 0.13)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
    }
}
