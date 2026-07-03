// web/src/components/Icon.tsx
// §60 — unified Icon component with consistent lucide-react icon map,
//        hover tooltip, hover colorize. Use everywhere in place of raw lucide imports.

import { forwardRef, useState } from 'react'
import {
  Swords, Users, BookOpen, BarChart2, Dice6, Coins, BookMarked,
  Image, Bug, Sparkles, LogIn, LogOut, User, Home, Menu,
  X, Search, Filter, ChevronDown, ChevronUp, ChevronRight,
  Plus, Minus, Trash2, Copy, RefreshCw, Settings, Eye, EyeOff,
  Shield, Zap, Heart, Skull, Crown, Star, Flame, Droplets,
  TreePine, Wind, Sun, Moon, Globe, Lock, Unlock, Bell, BellOff,
  MessageCircle, Volume2, VolumeX, MoreHorizontal, ExternalLink,
  Download, Upload, Check, AlertCircle, Info, HelpCircle, Send,
  type LucideIcon,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Icon map ──────────────────────────────────────────────────────────────────
export const ICON_MAP = {
  // Nav / pages
  home:       Home,
  lobby:      Users,
  decks:      BookOpen,
  play:       Swords,
  profile:    User,
  signIn:     LogIn,
  signOut:    LogOut,
  // Tools
  dice:       Dice6,
  coin:       Coins,
  terms:      BookMarked,
  playmat:    Image,
  bugReport:  Bug,
  whatsNew:   Sparkles,
  // CRUD
  menu:       Menu,
  close:      X,
  search:     Search,
  filter:     Filter,
  more:       MoreHorizontal,
  chevDown:   ChevronDown,
  chevUp:     ChevronUp,
  chevRight:  ChevronRight,
  add:        Plus,
  remove:     Minus,
  delete:     Trash2,
  copy:       Copy,
  refresh:    RefreshCw,
  settings:   Settings,
  show:       Eye,
  hide:       EyeOff,
  external:   ExternalLink,
  download:   Download,
  upload:     Upload,
  check:      Check,
  send:       Send,
  // Status
  alert:      AlertCircle,
  info:       Info,
  help:       HelpCircle,
  bell:       Bell,
  bellOff:    BellOff,
  // MTG flavour
  shield:     Shield,
  lightning:  Zap,
  heart:      Heart,
  skull:      Skull,
  crown:      Crown,
  star:       Star,
  flame:      Flame,
  water:      Droplets,
  forest:     TreePine,
  wind:       Wind,
  sun:        Sun,
  moon:       Moon,
  globe:      Globe,
  lock:       Lock,
  unlock:     Unlock,
  chat:       MessageCircle,
  soundOn:    Volume2,
  soundOff:   VolumeX,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICON_MAP

// ── Tooltip component ─────────────────────────────────────────────────────────
function Tooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.92 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-[200]"
        >
          <span
            className="whitespace-nowrap text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded"
            style={{
              background: 'var(--ink-3)',
              color: 'var(--paper)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Icon component ────────────────────────────────────────────────────────────
interface IconProps {
  name: IconName
  size?: number
  tooltip?: string
  color?: string        // override color (default inherits)
  hoverColor?: string   // color on hover (default: brand-bright)
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 18, tooltip, color, hoverColor, strokeWidth = 1.5, className, style }, ref) => {
    const [hovered, setHovered] = useState(false)
    const Comp = ICON_MAP[name] as LucideIcon

    const resolvedColor = hovered
      ? (hoverColor ?? 'var(--brand-bright)')
      : (color ?? 'currentColor')

    return (
      <span
        className={['relative inline-flex items-center justify-center', className].filter(Boolean).join(' ')}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {tooltip && <Tooltip label={tooltip} visible={hovered} />}
        <motion.span
          animate={{ color: resolvedColor }}
          transition={{ duration: 0.18 }}
          style={{ display: 'flex' }}
        >
          <Comp ref={ref} size={size} strokeWidth={strokeWidth} />
        </motion.span>
      </span>
    )
  }
)
Icon.displayName = 'Icon'

// ── IconButton ─────────────────────────────────────────────────────────────────
// A button wrapper with consistent sizing, tooltip, hover-colorize.
interface IconButtonProps extends IconProps {
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
  buttonClassName?: string
  buttonStyle?: React.CSSProperties
}

export function IconButton({
  onClick,
  disabled,
  buttonClassName,
  buttonStyle,
  ...iconProps
}: IconButtonProps) {
  const label = iconProps['aria-label'] ?? iconProps.tooltip

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        'inline-grid place-items-center w-8 h-8 rounded-md transition-colors duration-[220ms]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--ink-3)] active:scale-95',
        buttonClassName,
      ].filter(Boolean).join(' ')}
      style={buttonStyle}
    >
      <Icon {...iconProps} />
    </button>
  )
}
