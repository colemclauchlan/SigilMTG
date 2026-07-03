import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        TabView {
            NavigationStack {
                TableView()
                    .navigationTitle("Magic Table Tracker")
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Text(appState.syncStatus)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Reset") {
                                appState.resetGame()
                            }
                        }
                    }
            }
            .tabItem {
                Label("Table", systemImage: "person.3.fill")
            }

            NavigationStack {
                DeckBuilderView()
            }
            .tabItem {
                Label("Decks", systemImage: "rectangle.stack.fill")
            }
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
