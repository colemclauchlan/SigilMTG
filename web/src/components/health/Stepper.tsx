/**
 * Stepper — reusable +/− step button (§5 #50).
 * + hovers green, − hovers red, everywhere in Play.
 * Pass sign='+' or sign='-' to control which it is.
 */
import { useState } from 'react'

interface StepperProps {
  sign: '+' | '-'
  onClick: () => void
  size?: number
  disabled?: boolean
  title?: string
}

export default function Stepper({ sign, onClick, size = 32, disabled = false, title }: StepperProps) {
  const [hover, setHover] = useState(false)

  const hoverColor = sign === '+' ? 'rgba(70,178,119,0.22)' : 'rgba(224,101,92,0.22)'
  const hoverBorder = sign === '+' ? 'rgba(70,178,119,0.55)' : 'rgba(224,101,92,0.55)'
  const hoverText = sign === '+' ? 'var(--success)' : 'var(--danger)'

  return (
    <button
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--r-sm)',
        border: `1px solid ${hover ? hoverBorder : 'var(--hairline)'}`,
        background: hover ? hoverColor : 'var(--ink-2)',
        color: hover ? hoverText : 'var(--muted)',
        fontSize: size > 28 ? '1.2rem' : '1rem',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 130ms, color 130ms, border-color 130ms',
        flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
        fontFamily: 'var(--font-body)',
        lineHeight: 1,
        padding: 0,
      }}
    >
      {sign === '+' ? '+' : '−'}
    </button>
  )
}
