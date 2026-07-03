import UIKit

final class HapticsService {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let notification = UINotificationFeedbackGenerator()

    func life(delta: Int) {
        delta > 0 ? light.impactOccurred() : medium.impactOccurred()
    }

    func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    func major() {
        notification.notificationOccurred(.success)
    }
}
