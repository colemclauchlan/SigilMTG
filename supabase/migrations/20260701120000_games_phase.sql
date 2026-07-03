-- ============================================================
-- Sigil — multiplayer turn-phase sync
-- ============================================================
-- table-sync.js rebuilt remote state with a hardcoded phase ("main1") because the
-- games table had no phase column, so the phase bar desynced across clients
-- (COWORK_LEDGER Phase 6, KNOWN GAP). Additive + safe to run once.
-- ============================================================

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'main1';
