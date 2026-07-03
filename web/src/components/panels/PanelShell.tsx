/**
 * PanelShell — top-level component that renders all floating HUD elements.
 * Imported once in Tabletop.tsx and renders everything over the board.
 *
 * z-index hierarchy:
 *   board=0, hand=10, HUD=50, panels=100, menus=200, modals=300
 */
import GameHUD from '../hud/GameHUD'
import ActionLog from '../hud/ActionLog'
import PinnedCounter from '../hud/PinnedCounter'

export default function PanelShell() {
  return (
    <>
      {/* ── HUD bar (always shown when game is active) ── */}
      <GameHUD />

      {/* ── Floating action log (shown when ui.logOpen) ── */}
      <ActionLog />

      {/* ── Pinned counter annotations (one per gameState.annotations counter) ── */}
      <PinnedCounter />

      {/* ── Placeholder comments for Worker C modals ── */}
      {/* InspectModal — imported by Tabletop.tsx */}
      {/* ZoneViewer — imported by Tabletop.tsx */}
      {/* TutorModal — imported by Tabletop.tsx */}
    </>
  )
}
