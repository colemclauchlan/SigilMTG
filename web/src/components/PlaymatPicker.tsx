// web/src/components/PlaymatPicker.tsx
// §63 — High-res, non-stretched playmat system (object-fit:cover).
//        Includes Sigil-brand SVG mats + a URL/solid-color picker.
//        TODO: OpenRouter image proxy seam for AI-generated mats (see below).

import { useState, useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Image, Palette } from 'lucide-react'

export interface PlaymatEntry {
  id: string
  label: string
  type: 'sigil' | 'solid' | 'url'
  value: string   // SVG data URI, hex color, or https:// URL
  preview?: string
}

// ── Sigil-brand SVG mats (generated via canvas/SVG — brand palette) ───────────
function makeSigilSVG(variant: 'void' | 'forge' | 'grove' | 'storm'): string {
  const configs = {
    void: {
      bg: '#040c1a', accent: '#4da3ff', accent2: '#1f4a8a',
      label: 'Void',
    },
    forge: {
      bg: '#1a0804', accent: '#ff6b35', accent2: '#8a2a1f',
      label: 'Forge',
    },
    grove: {
      bg: '#041a08', accent: '#46b277', accent2: '#1a5a30',
      label: 'Grove',
    },
    storm: {
      bg: '#0d0a1a', accent: '#b277ff', accent2: '#4a1a8a',
      label: 'Storm',
    },
  }
  const c = configs[variant]
  // Complex SVG with brand geometry — diagonal lines, central sigil motif, noise-like texture
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
  <defs>
    <radialGradient id="rg-${variant}" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${c.accent2}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${c.bg}"/>
    </radialGradient>
    <pattern id="grid-${variant}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${c.accent}" stroke-width="0.3" opacity="0.18"/>
    </pattern>
    <filter id="blur-${variant}">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <!-- Base -->
  <rect width="900" height="500" fill="${c.bg}"/>
  <!-- Gradient overlay -->
  <rect width="900" height="500" fill="url(#rg-${variant})"/>
  <!-- Grid -->
  <rect width="900" height="500" fill="url(#grid-${variant})"/>
  <!-- Diagonal accent lines -->
  <line x1="0" y1="500" x2="900" y2="0" stroke="${c.accent}" stroke-width="0.6" opacity="0.15"/>
  <line x1="-100" y1="500" x2="800" y2="0" stroke="${c.accent}" stroke-width="0.4" opacity="0.1"/>
  <line x1="100" y1="500" x2="1000" y2="0" stroke="${c.accent}" stroke-width="0.4" opacity="0.1"/>
  <!-- Central sigil circle -->
  <circle cx="450" cy="250" r="120" fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.3"/>
  <circle cx="450" cy="250" r="90" fill="none" stroke="${c.accent}" stroke-width="0.5" opacity="0.2"/>
  <circle cx="450" cy="250" r="160" fill="none" stroke="${c.accent}" stroke-width="0.4" opacity="0.12"/>
  <!-- Corner runes (stylised brackets) -->
  <path d="M 40 40 L 40 70 L 70 70" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.5"/>
  <path d="M 860 40 L 860 70 L 830 70" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.5"/>
  <path d="M 40 460 L 40 430 L 70 430" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.5"/>
  <path d="M 860 460 L 860 430 L 830 430" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.5"/>
  <!-- Wordmark -->
  <text x="450" y="258" text-anchor="middle" dominant-baseline="middle"
    font-family="'Cinzel', Georgia, serif" font-weight="800" font-size="28"
    letter-spacing="10" fill="${c.accent}" opacity="0.35">SIGIL</text>
  <text x="450" y="284" text-anchor="middle" dominant-baseline="middle"
    font-family="'Inter', sans-serif" font-weight="500" font-size="9"
    letter-spacing="5" fill="${c.accent}" opacity="0.2">${c.label.toUpperCase()} MAT</text>
</svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

// ── AI-generated mats (OpenArt CDN) — background-image, center/cover ─────────
const AI_MATS: PlaymatEntry[] = [
  {
    id: 'ai-sigil-void',
    label: 'Sigil Void',
    type: 'url',
    value: 'https://cdn.openart.ai/openart-ai/production/2026-06/create-image/ZRFTU3lnQNK5s7Nk4zlo/image_1782714261369_0a1553a2_1782714261587_2ca296fa.png',
  },
  {
    id: 'ai-sigil-ember',
    label: 'Sigil Ember',
    type: 'url',
    value: 'https://cdn.openart.ai/openart-ai/production/2026-06/create-image/ZRFTU3lnQNK5s7Nk4zlo/image_1782714264127_21e1bd84_1782714264181_39ff65a4.png',
  },
]

// ── Sigil Crest mat — inline SVG data-URI: dark teal→navy radial gradient ────
// Crossed-swords brand logo centered at scale 10× (lucide Swords 24×24 paths).
// Opacity 0.10 — reads as a subtle branded board surface.
const CREST_MAT: PlaymatEntry = {
  id: 'sigil-crest',
  label: 'Sigil Crest',
  type: 'sigil',
  value: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20900%20500%22%20width%3D%22900%22%20height%3D%22500%22%3E%0A%3Cdefs%3E%0A%20%20%3CradialGradient%20id%3D%22rg-crest%22%20cx%3D%2250%25%22%20cy%3D%2250%25%22%20r%3D%2265%25%22%3E%0A%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23102a3d%22%2F%3E%0A%20%20%20%20%3Cstop%20offset%3D%2255%25%22%20stop-color%3D%22%230b1b2a%22%2F%3E%0A%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23070f18%22%2F%3E%0A%20%20%3C%2FradialGradient%3E%0A%20%20%3Cpattern%20id%3D%22grid-crest%22%20width%3D%2240%22%20height%3D%2240%22%20patternUnits%3D%22userSpaceOnUse%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M%2040%200%20L%200%200%200%2040%22%20fill%3D%22none%22%20stroke%3D%22%234da3ff%22%20stroke-width%3D%220.3%22%20opacity%3D%220.08%22%2F%3E%0A%20%20%3C%2Fpattern%3E%0A%20%20%3CradialGradient%20id%3D%22sealGlow-crest%22%20cx%3D%2250%25%22%20cy%3D%2242%25%22%20r%3D%2260%25%22%3E%0A%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%238fd0ff%22%20stop-opacity%3D%220.14%22%2F%3E%0A%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%234da3ff%22%20stop-opacity%3D%220%22%2F%3E%0A%20%20%3C%2FradialGradient%3E%0A%3C%2Fdefs%3E%0A%3C%21--%20Base%20--%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22500%22%20fill%3D%22%23070f18%22%2F%3E%0A%3C%21--%20Gradient%20overlay%20--%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22500%22%20fill%3D%22url%28%23rg-crest%29%22%2F%3E%0A%3C%21--%20Grid%20--%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22500%22%20fill%3D%22url%28%23grid-crest%29%22%2F%3E%0A%3C%21--%20Corner%20rune%20brackets%20--%3E%0A%3Cpath%20d%3D%22M%2040%2040%20L%2040%2070%20L%2070%2070%22%20fill%3D%22none%22%20stroke%3D%22%234da3ff%22%20stroke-width%3D%221.5%22%20opacity%3D%220.25%22%2F%3E%0A%3Cpath%20d%3D%22M%20860%2040%20L%20860%2070%20L%20830%2070%22%20fill%3D%22none%22%20stroke%3D%22%234da3ff%22%20stroke-width%3D%221.5%22%20opacity%3D%220.25%22%2F%3E%0A%3Cpath%20d%3D%22M%2040%20460%20L%2040%20430%20L%2070%20430%22%20fill%3D%22none%22%20stroke%3D%22%234da3ff%22%20stroke-width%3D%221.5%22%20opacity%3D%220.25%22%2F%3E%0A%3Cpath%20d%3D%22M%20860%20460%20L%20860%20430%20L%20830%20430%22%20fill%3D%22none%22%20stroke%3D%22%234da3ff%22%20stroke-width%3D%221.5%22%20opacity%3D%220.25%22%2F%3E%0A%3C%21--%20Mana-seal%20centered%20%E2%80%94%20glow%20disc%2C%20outer%20ring%2C%20pentagon%2C%205%20WUBRG%20nodes%20%E2%80%94%20at%20opacity%200.13%20--%3E%0A%3Cg%20transform%3D%22translate%28450%2C250%29%22%20opacity%3D%220.13%22%3E%0A%20%20%3C%21--%20Glow%20--%3E%0A%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%22126%22%20fill%3D%22url%28%23sealGlow-crest%29%22%2F%3E%0A%20%20%3C%21--%20Outer%20ring%20--%3E%0A%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%22111%22%20fill%3D%22none%22%20stroke%3D%22%238fd0ff%22%20stroke-width%3D%227.8%22%20opacity%3D%220.85%22%2F%3E%0A%20%20%3C%21--%20Pentagon%3A%205%20pts%20at%20r%3D102%2C%20starting%20top%20%28-90%C2%B0%29%20--%3E%0A%20%20%3Cpolygon%20points%3D%220%2C-102%2097.1%2C-31.6%2060.0%2C82.8%20-60.0%2C82.8%20-97.1%2C-31.6%22%0A%20%20%20%20fill%3D%22none%22%20stroke%3D%22%236fa8e0%22%20stroke-width%3D%226.6%22%20opacity%3D%220.7%22%2F%3E%0A%20%20%3C%21--%20W%20top%20--%3E%0A%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%22-102%22%20r%3D%2218.6%22%20fill%3D%22%23eef0ea%22%20stroke%3D%22%23070d1a%22%20stroke-width%3D%223.6%22%2F%3E%0A%20%20%3C%21--%20U%20upper-right%20--%3E%0A%20%20%3Ccircle%20cx%3D%2297.1%22%20cy%3D%22-31.6%22%20r%3D%2218.6%22%20fill%3D%22%234aa3e6%22%20stroke%3D%22%23070d1a%22%20stroke-width%3D%223.6%22%2F%3E%0A%20%20%3C%21--%20B%20lower-right%20--%3E%0A%20%20%3Ccircle%20cx%3D%2260.0%22%20cy%3D%2282.8%22%20r%3D%2218.6%22%20fill%3D%22%239b86c4%22%20stroke%3D%22%23070d1a%22%20stroke-width%3D%223.6%22%2F%3E%0A%20%20%3C%21--%20R%20lower-left%20--%3E%0A%20%20%3Ccircle%20cx%3D%22-60.0%22%20cy%3D%2282.8%22%20r%3D%2218.6%22%20fill%3D%22%23e0655c%22%20stroke%3D%22%23070d1a%22%20stroke-width%3D%223.6%22%2F%3E%0A%20%20%3C%21--%20G%20upper-left%20--%3E%0A%20%20%3Ccircle%20cx%3D%22-97.1%22%20cy%3D%22-31.6%22%20r%3D%2218.6%22%20fill%3D%22%2346b277%22%20stroke%3D%22%23070d1a%22%20stroke-width%3D%223.6%22%2F%3E%0A%3C%2Fg%3E%0A%3C%21--%20SIGIL%20wordmark%20--%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22390%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%0A%20%20font-family%3D%22Cinzel%2CGeorgia%2Cserif%22%20font-weight%3D%22800%22%20font-size%3D%2218%22%0A%20%20letter-spacing%3D%2210%22%20fill%3D%22%234da3ff%22%20opacity%3D%220.18%22%3ESIGIL%3C%2Ftext%3E%0A%3C%2Fsvg%3E',
}

const SIGIL_MATS: PlaymatEntry[] = [
  CREST_MAT,
  ...AI_MATS,
  { id: 'sigil-void',  label: 'Void',  type: 'sigil', value: makeSigilSVG('void')  },
  { id: 'sigil-forge', label: 'Forge', type: 'sigil', value: makeSigilSVG('forge') },
  { id: 'sigil-grove', label: 'Grove', type: 'sigil', value: makeSigilSVG('grove') },
  { id: 'sigil-storm', label: 'Storm', type: 'sigil', value: makeSigilSVG('storm') },
]

const SOLID_MATS: PlaymatEntry[] = [
  { id: 'solid-felt',    label: 'Felt',        type: 'solid', value: '#1a2b1a' },
  { id: 'solid-obsidian',label: 'Obsidian',    type: 'solid', value: '#0e0e12' },
  { id: 'solid-navy',    label: 'Navy',         type: 'solid', value: '#070d1a' },
  { id: 'solid-crimson', label: 'Crimson',      type: 'solid', value: '#1a0808' },
  { id: 'solid-slate',   label: 'Slate',        type: 'solid', value: '#111827' },
  { id: 'solid-sand',    label: 'Sand',         type: 'solid', value: '#2a2216' },
]

// TODO: OpenRouter image proxy — when VITE_OPENROUTER_KEY is set, expose a
// "Generate with AI" button here that calls /api/generate-mat with a prompt
// and injects the returned image URL into MATS. Human gate: requires API key config.
// Seam: see PlaymatPicker.tsx → "AI Generate" section below marked with TODO.

interface Props {
  open: boolean
  onClose: () => void
  current?: string          // current mat id
  onSelect: (mat: PlaymatEntry) => void
}

type Tab = 'sigil' | 'solid' | 'art' | 'url'

export default function PlaymatPicker({ open, onClose, current, onSelect }: Props) {
  const [tab,    setTab]    = useState<Tab>('sigil')
  const [urlVal, setUrlVal] = useState('')
  const [artMats, setArtMats] = useState<PlaymatEntry[]>([])
  const [artLoading, setArtLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'art' || artMats.length || artLoading) return
    setArtLoading(true)
    fetch('https://api.scryfall.com/cards/search?q=' + encodeURIComponent('is:fullart type:basic') + '&unique=art&order=released&dir=desc')
      .then((r) => r.json())
      .then((j: { data?: Array<{ id: string; name: string; image_uris?: { art_crop?: string } }> }) => {
        const mats: PlaymatEntry[] = (j.data ?? []).slice(0, 24)
          .map((c) => ({ id: 'art-' + c.id, label: c.name, type: 'url' as const, value: c.image_uris?.art_crop ?? '' }))
          .filter((mm) => mm.value)
        setArtMats(mats)
      })
      .catch(() => { /* network — leave empty */ })
      .finally(() => setArtLoading(false))
  }, [tab, artMats.length, artLoading])

  const handleUrl = () => {
    if (!urlVal.trim()) return
    const entry: PlaymatEntry = { id: `url-${Date.now()}`, label: 'Custom', type: 'url', value: urlVal.trim() }
    onSelect(entry)
    onClose()
  }

  const allMats = tab === 'sigil' ? SIGIL_MATS : tab === 'solid' ? SOLID_MATS : tab === 'art' ? artMats : []

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[100] mx-auto max-w-2xl"
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--hairline)' }}>
              <Image size={16} style={{ color: 'var(--brand-bright)' }} />
              <span className="font-display font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--brand-bright)' }}>
                Playmat
              </span>
              <div className="flex items-center gap-1 ml-2">
                {(['sigil', 'solid', 'art', 'url'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase transition-colors"
                    style={{
                      background: tab === t ? 'var(--brand-soft)' : 'transparent',
                      color: tab === t ? 'var(--brand-bright)' : 'var(--muted)',
                    }}
                  >
                    {t === 'sigil' ? 'Sigil' : t === 'solid' ? 'Solid' : t === 'art' ? 'MTG art' : 'URL'}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ink-3)]" style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="p-4">
              {tab === 'url' ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Paste an image URL (HTTPS). The image will be shown with object-fit: cover — no stretching.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={urlVal}
                      onChange={e => setUrlVal(e.target.value)}
                      placeholder="https://example.com/playmat.jpg"
                      className="flex-1 px-3 py-2 text-sm rounded-md outline-none"
                      style={{
                        background: 'var(--ink-2)',
                        border: '1px solid var(--hairline)',
                        color: 'var(--paper)',
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleUrl() }}
                    />
                    <button
                      onClick={handleUrl}
                      className="px-4 py-2 text-xs font-bold rounded-md transition-colors"
                      style={{
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-bright)',
                        border: '1px solid var(--brand)',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  {/* TODO: OpenRouter image proxy — AI Generate button goes here.
                      When VITE_OPENROUTER_KEY is configured:
                      <button onClick={handleAiGenerate}>Generate with AI</button>
                      calls POST /api/generate-mat { prompt } → { url }
                  */}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {tab === 'art' && artLoading && allMats.length === 0 && <p className="col-span-full text-xs text-center py-6" style={{ color: 'var(--muted)' }}>Loading full-art lands…</p>}
                  {allMats.map(mat => {
                    const isSelected = current === mat.id
                    return (
                      <button
                        key={mat.id}
                        onClick={() => { onSelect(mat); onClose() }}
                        className="relative rounded-lg overflow-hidden transition-all duration-200"
                        style={{
                          aspectRatio: '16/9',
                          border: isSelected ? '2px solid var(--brand-bright)' : '1px solid var(--hairline)',
                          boxShadow: isSelected ? 'var(--glow)' : 'none',
                        }}
                      >
                        {mat.type === 'solid' ? (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: mat.value }}>
                            <Palette size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
                          </div>
                        ) : (
                          <img
                            src={mat.value}
                            alt={mat.label}
                            className="w-full h-full"
                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                            draggable={false}
                          />
                        )}
                        <div
                          className="absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-center"
                          style={{ background: 'rgba(4,10,20,0.7)', color: 'var(--paper-dim)' }}
                        >
                          {mat.label}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <Check size={11} style={{ color: '#000' }} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Utility: apply a mat to a CSS background ──────────────────────────────────
export function applyMat(mat: PlaymatEntry | undefined, el: HTMLElement | null) {
  if (!el) return
  if (!mat) {
    el.style.background = 'var(--navy)'
    el.style.backgroundImage = ''
    return
  }
  if (mat.type === 'solid') {
    el.style.background = mat.value
    el.style.backgroundImage = ''
  } else {
    el.style.backgroundImage = `url("${mat.value}")`
    el.style.backgroundSize = 'cover'
    el.style.backgroundPosition = 'center'
  }
}
