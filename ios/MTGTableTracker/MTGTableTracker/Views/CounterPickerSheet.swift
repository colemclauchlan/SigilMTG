import SwiftUI

struct CounterPickerSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    let player: PlayerState

    var body: some View {
        NavigationStack {
            List {
                ForEach(CounterKey.allCases.filter { $0 != .commander }) { key in
                    Button {
                        appState.toggleCounter(playerId: player.id, key: key)
                    } label: {
                        HStack {
                            Text(key.label)
                            Spacer()
                            if player.visibleCounterKeys.contains(key) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.cyan)
                            }
                        }
                    }
                    .disabled(key == .tax)
                }
            }
            .navigationTitle("More counters")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
