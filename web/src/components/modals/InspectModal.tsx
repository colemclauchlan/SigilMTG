/**
 * InspectModal — full card detail view with alternate prints, external links,
 * and a deck-builder placeholder action.
 */
import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

const CARD_BACK = 'https://cards.scryfall.io/normal/back/0/0/default_card_back.jpg'

interface AltPrint {
  id: string
  name: string
  set: string
  collector_number: string
  image_uris?: { small?: string; normal?: string }
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>
  purchase_uris?: { tcgplayer?: string }
}

function getThumb(p: AltPrint): string {
  const uris = p.image_uris ?? p.card_faces?.[0]?.image_uris
  return uris?.small ?? uris?.normal ?? CARD_BACK
}

export default function InspectModal() {
  const inspectCardId = useGameStore((s) => s.ui.inspectCardId)
  const openInspect = useGameStore((s) => s.openInspect)
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)
  const pushLogEntry = useGameStore((s) => s.pushLogEntry)
  const { dispatch } = useGameEngine()

  const [altPrints, setAltPrints] = useState<AltPrint[]>([])
  const [altsLoading, setAltsLoading] = useState(false)
  const [tcgLink, setTcgLink] = useState<string | null>(null)

  const card = inspectCardId && gameState
    ? gameState.cards[inspectCardId] ?? null
    : null

  const meta = card?.cardId ? imagesById[card.cardId] ?? null : null
  const imgSrc = card?.faceDown ? CARD_BACK : (meta?.img ?? CARD_BACK)
  const cardName = card?.name ?? ''
  const typeLine = meta?.type ?? ''
  const scryfallId = meta?.scryfallId ?? null

  const close = useCallback(() => openInspect(null), [openInspect])

  // Fetch alternate prints from Scryfall when card changes
  useEffect(() => {
    if (!cardName) return
    setAltPrints([])
    setTcgLink(null)
    setAltsLoading(true)

    const encoded = encodeURIComponent(`!"${cardName}"`)
    const url = `https://api.scryfall.com/cards/search?q=${encoded}&unique=prints&order=released`

    fetch(url)
      .then((r) => r.json())
      .then((data: { data?: AltPrint[] }) => {
        if (data.data) {
          setAltPrints(data.data.slice(0, 16))
          const first = data.data[0]
          if (first?.purchase_uris?.tcgplayer) {
            setTcgLink(first.purchase_uris.tcgplayer)
          }
        }
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setAltsLoading(false))
  }, [cardName])

  function handleSetArt(print: AltPrint) {
    if (!card) return
    dispatch({
      t: 'card_setart',
      instanceId: card.instanceId,
      setCode: print.set,
      collectorNumber: print.collector_number,
    })
  }

  function handleAddToDeck() {
    if (!cardName) return
    pushLogEntry(`Added <b>${cardName}</b> to deck builder (placeholder)`)
    // eslint-disable-next-line no-console
    console.info('[Deck Builder] Added', cardName)
  }

  const scryfallSearch = `https://scryfall.com/search?q=${encodeURIComponent(`!"${cardName}"`)}`
  const tcgUrl = tcgLink ?? `https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(cardName)}`
  const moxfieldUrl = scryfallId
    ? `https://www.moxfield.com/cards/${scryfallId}`
    : `https://www.moxfield.com/search?q=${encodeURIComponent(cardName)}`

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key="inspect-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(7,13,26,0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            key="inspect-panel"
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: 700,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px 28px 32px',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={close}
              title="Close"
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'var(--ink-2)', border: 'none',
                borderRadius: 'var(--r-sm)', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--muted)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--paper)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
            >
              <X size={16} />
            </button>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {/* Card image */}
              <div style={{ flexShrink: 0 }}>
                <img
                  src={imgSrc}
                  alt={cardName}
                  onError={(e) => { (e.target as HTMLImageElement).src = CARD_BACK }}
                  style={{
                    width: 220,
                    height: Math.round(220 * 1.4),
                    borderRadius: 'var(--r-card)',
                    objectFit: 'cover',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'block',
                  }}
                />
              </div>

              {/* Right column */}
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Name + type */}
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.3rem',
                    fontWeight: 700, color: 'var(--paper)', margin: 0,
                  }}>
                    {cardName}
                  </h2>
                  {typeLine && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      {typeLine}
                    </p>
                  )}
                </div>

                {/* External links */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(
                    [
                      { label: 'Scryfall', href: scryfallSearch, color: '#e97a2e' },
                      { label: 'TCGPlayer', href: tcgUrl, color: '#4da3ff' },
                      { label: 'Moxfield', href: moxfieldUrl, color: '#9b86c4' },
                    ] as const
                  ).map(({ label, href, color }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 'var(--r-sm)',
                        background: 'var(--ink-2)', border: '1px solid var(--hairline)',
                        color, textDecoration: 'none',
                        fontSize: '0.8rem', fontWeight: 600,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = color
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline)'
                      }}
                    >
                      <ExternalLink size={12} />
                      {label}
                    </a>
                  ))}
                </div>

                {/* Add to Deck Builder */}
                <button
                  onClick={handleAddToDeck}
                  style={{
                    background: 'var(--brand-soft)',
                    border: '1px solid var(--brand)',
                    borderRadius: 'var(--r-sm)',
                    color: 'var(--brand-bright)',
                    padding: '8px 16px',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.15s',
                    alignSelf: 'flex-start',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(77,163,255,0.28)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--brand-soft)'
                  }}
                >
                  + Add to Deck Builder
                </button>

                {/* Alternate prints */}
                <div>
                  <p style={{
                    color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    margin: '0 0 10px',
                  }}>
                    Alternate Prints
                  </p>

                  {altsLoading && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      color: 'var(--faint)', fontSize: '0.82rem',
                    }}>
                      <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                      Loading…
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {!altsLoading && altPrints.length === 0 && (
                    <p style={{ color: 'var(--faint)', fontSize: '0.8rem' }}>
                      No alternate prints found.
                    </p>
                  )}

                  {!altsLoading && altPrints.length > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 8,
                      maxHeight: 260, overflowY: 'auto',
                    }}>
                      {altPrints.map((print) => (
                        <button
                          key={print.id}
                          onClick={() => handleSetArt(print)}
                          title={`${print.set.toUpperCase()} #${print.collector_number}`}
                          style={{
                            background: 'none', border: '2px solid var(--hairline)',
                            borderRadius: 'var(--r-sm)', padding: 2,
                            cursor: 'pointer', transition: 'border-color 0.15s',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 3,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline)'
                          }}
                        >
                          <img
                            src={getThumb(print)}
                            alt={print.set}
                            style={{
                              width: 60, height: Math.round(60 * 1.4),
                              borderRadius: 5, objectFit: 'cover', display: 'block',
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).src = CARD_BACK }}
                          />
                          <span style={{
                            color: 'var(--faint)', fontSize: '0.65rem',
                            lineHeight: 1.2, textAlign: 'center',
                          }}>
                            {print.set.toUpperCase()}<br />
                            #{print.collector_number}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
