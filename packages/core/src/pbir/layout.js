export const PAGE_SIZE_PRESETS = {
  '16:9':    { label: '16:9 (1280×720)',     width: 1280, height: 720  },
  '16:10':   { label: '16:10 (1280×800)',    width: 1280, height: 800  },
  '4:3':     { label: '4:3 (1024×768)',      width: 1024, height: 768  },
  'tall':    { label: 'Tall (1280×1920)',    width: 1280, height: 1920 },
  'square':  { label: 'Square (1024×1024)',  width: 1024, height: 1024 },
  'auto':    { label: 'Auto-fit content',    width: 1280, height: null }, // height computed at render
  'custom':  { label: 'Custom…',              width: null, height: null }, // both from layout.pageWidth/pageHeight
}

// Clamps for custom page size (prevents degenerate values)
export const PAGE_SIZE_LIMITS = {
  minWidth:  640,
  minHeight: 480,
  maxWidth:  4096,
  maxHeight: 8192,
}

/** Default page size when AppSpec doesn't specify one. */
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_PRESETS['16:9']

export const OBJECT_TYPES = new Set(['text_box', 'shape', 'image', 'divider'])
