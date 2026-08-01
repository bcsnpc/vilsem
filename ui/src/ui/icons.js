// Curated icon set. The rest of the chrome imports icons from here (not directly
// from lucide-react) so the icon library is swappable from one file. Tree-shaken
// — only the glyphs imported below ship in the bundle.

export {
  // navigation / chrome
  ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  X, Plus, Check, Search, Settings, LogOut, MoreHorizontal,
  // theme
  Sun, Moon,
  // actions
  Pencil, Play, Save, Download, Upload, Trash2, Copy, RefreshCw, Wand2,
  // editor
  LayoutGrid, SlidersHorizontal, Filter, Columns3, Plus as PlusIcon,
  // feedback / brand
  Sparkles, AlertTriangle, Info, CircleCheck, Loader2, Layers,
} from 'lucide-react'

import React from 'react'
import * as Lucide from 'lucide-react'

// Generic helper: <Icon name="Settings" size={16} />
export function Icon({ name, size = 16, strokeWidth = 1.75, color = 'currentColor', style, ...rest }) {
  const Cmp = Lucide[name]
  if (!Cmp) return null
  return React.createElement(Cmp, { size, strokeWidth, color, style, ...rest })
}
