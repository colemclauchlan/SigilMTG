/**
 * SettingsPopup — vanilla play-hud.js openSettings() parity:
 * Change playmat / Shuffle library / End game.
 */
import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shuffle, LogOut, Image as ImageIcon } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

export default function SettingsPopup({ onClose, onChangeMat }: { onClose: () => void; onChangeMat?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const mySeat = useGameStore((s) => s.mySeat)
  const { dispatch } = useGameEngine()

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('click', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-200)', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }
  const Row = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button onClick={() => { onClick(); onClose() }} style={danger ? { ...rowStyle, color: 'var(--danger)', borderColor: 'rgba(224,101,92,0.3)' } : rowStyle}>{icon}{label}</button>
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 70, width: 210,
        background: 'var(--glass-strong)', backdropFilter: 'blur(16px)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 10, display: 'flex', flexDirection: 'column', gap: 7,
      }}
    >
      <p style={{ fontSize: 'var(--fs-100)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, margin: '0 0 2px' }}>Settings</p>
      {onChangeMat && <Row icon={<ImageIcon size={14} />} label="Change playmat" onClick={onChangeMat} />}
      <Row icon={<Shuffle size={14} />} label="Shuffle library" onClick={() => dispatch({ t: 'library_shuffle', seat: mySeat } as never)} />
      <Row icon={<LogOut size={14} />} label="End game" onClick={() => navigate('/lobby')} danger />
    </div>
  )
}
