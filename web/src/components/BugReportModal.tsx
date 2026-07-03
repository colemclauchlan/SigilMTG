// web/src/components/BugReportModal.tsx
// §64 — Bug report modal. Opens from top-bar IconButton.
// Collects: title, category, steps, severity. On submit, logs to console + 
// copies pre-formatted text to clipboard (actual GitHub Issues or email integration
// is a human gate — add VITE_BUG_REPORT_WEBHOOK to wire Zapier/email).

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bug, Check, ChevronDown } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

type Severity = 'low' | 'medium' | 'high' | 'crash'
type Category = 'gameplay' | 'ui' | 'network' | 'performance' | 'other'

const SEVERITY_COLORS: Record<Severity, string> = {
  low:    '#5aa66a',
  medium: '#d5a23a',
  high:   '#d5705d',
  crash:  '#c94f4f',
}

export default function BugReportModal({ open, onClose }: Props) {
  const [title,    setTitle]    = useState('')
  const [category, setCategory] = useState<Category>('gameplay')
  const [steps,    setSteps]    = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [done,     setDone]     = useState(false)

  const valid = title.trim().length > 3

  const handleSubmit = async () => {
    if (!valid) return
    const report = [
      `[BUG] ${title}`,
      `Severity: ${severity}  |  Category: ${category}`,
      '',
      'Steps to reproduce:',
      steps || '(not provided)',
      '',
      `App version: Sigil P6  |  Date: ${new Date().toISOString()}`,
      `UA: ${navigator.userAgent}`,
    ].join('\n')

    // Log to console
    console.warn('[Sigil Bug Report]\n', report)

    // Copy to clipboard as fallback
    try { await navigator.clipboard.writeText(report) } catch { /* ok */ }

    // TODO: wire webhook — if VITE_BUG_REPORT_WEBHOOK is set, POST report there
    // const hook = import.meta.env.VITE_BUG_REPORT_WEBHOOK
    // if (hook) await fetch(hook, { method:'POST', body: JSON.stringify({ report }) })

    setDone(true)
    setTimeout(() => {
      setDone(false); setTitle(''); setSteps(''); setSeverity('medium'); onClose()
    }, 1800)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[100] mx-auto max-w-md"
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--hairline)' }}>
              <Bug size={15} style={{ color: 'var(--brand-bright)' }} />
              <span className="font-display font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--brand-bright)' }}>
                Report a Bug
              </span>
              <span className="flex-1" />
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ink-3)]" style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--mana-g)', boxShadow: '0 0 20px rgba(70,178,119,0.4)' }}
                >
                  <Check size={22} style={{ color: '#fff' }} />
                </motion.div>
                <p className="text-sm font-bold" style={{ color: 'var(--paper)' }}>Report logged!</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Copied to clipboard too.</p>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Title <span style={{ color: 'var(--mana-r)' }}>*</span>
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Short description of the issue"
                    className="px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)', color: 'var(--paper)' }}
                  />
                </div>

                {/* Category + Severity row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Category</label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as Category)}
                        className="w-full px-3 py-2 text-sm rounded-md outline-none appearance-none"
                        style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)', color: 'var(--paper)' }}
                      >
                        <option value="gameplay">Gameplay</option>
                        <option value="ui">UI / Visual</option>
                        <option value="network">Network / MP</option>
                        <option value="performance">Performance</option>
                        <option value="other">Other</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Severity</label>
                    <div className="flex gap-1">
                      {(['low','medium','high','crash'] as Severity[]).map(s => (
                        <button
                          key={s}
                          onClick={() => setSeverity(s)}
                          className="flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all"
                          style={{
                            background: severity === s ? SEVERITY_COLORS[s] + '30' : 'var(--ink-2)',
                            border: `1px solid ${severity === s ? SEVERITY_COLORS[s] : 'var(--hairline)'}`,
                            color: severity === s ? SEVERITY_COLORS[s] : 'var(--muted)',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Steps to reproduce</label>
                  <textarea
                    value={steps}
                    onChange={e => setSteps(e.target.value)}
                    rows={4}
                    placeholder="1. Go to…&#10;2. Click…&#10;3. See error"
                    className="px-3 py-2 text-sm rounded-md outline-none resize-none"
                    style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)', color: 'var(--paper)' }}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!valid}
                  className="w-full py-2.5 text-sm font-bold rounded-md transition-all"
                  style={{
                    background: valid ? 'var(--brand-soft)' : 'var(--ink-2)',
                    border: `1px solid ${valid ? 'var(--brand)' : 'var(--hairline)'}`,
                    color: valid ? 'var(--brand-bright)' : 'var(--faint)',
                    cursor: valid ? 'pointer' : 'not-allowed',
                  }}
                >
                  Submit Report
                </button>
                <p className="text-[10px] text-center" style={{ color: 'var(--faint)' }}>
                  Report is logged locally and copied to clipboard.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
