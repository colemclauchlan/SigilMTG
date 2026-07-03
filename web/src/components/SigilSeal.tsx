// web/src/components/SigilSeal.tsx
// The Sigil mana-seal brand mark — reusable React component.
// Renders the canonical SVG: radial glow + outer ring + pentagon + 5 WUBRG nodes.
// Each instance gets a unique gradient id to avoid SVG <defs> collisions.
// Usage: <SigilSeal size={30} /> (default size=30)

import { useId } from 'react'

interface Props {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function SigilSeal({ size = 30, className, style }: Props) {
  // useId() guarantees unique ids per instance — avoids defs collision when
  // multiple SigilSeal instances appear on the same page.
  const uid = useId().replace(/:/g, '_')
  const gradId = `sigilGlow_${uid}`

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#8fd0ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4da3ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow disc */}
      <circle cx="24" cy="24" r="21" fill={`url(#${gradId})`} />
      {/* Outer ring */}
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="#8fd0ff" strokeWidth="1.3" opacity="0.85" />
      {/* Pentagon */}
      <polygon
        points="24,7 40.2,18.8 34,37.8 14,37.8 7.8,18.8"
        fill="none"
        stroke="#6fa8e0"
        strokeWidth="1.1"
        opacity="0.7"
      />
      {/* WUBRG nodes — W top, U upper-right, B lower-right, R lower-left, G upper-left */}
      <circle cx="24"   cy="7"    r="3.1" fill="#eef0ea" stroke="#070d1a" strokeWidth="0.6" />
      <circle cx="40.2" cy="18.8" r="3.1" fill="#4aa3e6" stroke="#070d1a" strokeWidth="0.6" />
      <circle cx="34"   cy="37.8" r="3.1" fill="#9b86c4" stroke="#070d1a" strokeWidth="0.6" />
      <circle cx="14"   cy="37.8" r="3.1" fill="#e0655c" stroke="#070d1a" strokeWidth="0.6" />
      <circle cx="7.8"  cy="18.8" r="3.1" fill="#46b277" stroke="#070d1a" strokeWidth="0.6" />
    </svg>
  )
}
