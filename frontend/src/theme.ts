import { createTheme, alpha } from '@mui/material/styles'

export const C = {
  black:   '#000000',
  black1:  '#0A0A0A',
  black2:  '#111111',
  red:     '#FF1744',
  redDim:  '#CC0033',
  redGlow: 'rgba(255,23,68,0.35)',
  amber:   '#FFB300',
  green:   '#00E676',
  blue:    '#2979FF',
  muted:   '#6B7280',
  mutedHi: '#9CA3AF',
  white:   '#FFFFFF',
  glass:   'rgba(255,255,255,0.04)',
  glassMd: 'rgba(255,255,255,0.07)',
  glassHi: 'rgba(255,255,255,0.11)',
  borderT: 'rgba(255,255,255,0.22)',
  borderL: 'rgba(255,255,255,0.10)',
  borderS: 'rgba(255,255,255,0.05)',
  border:  'rgba(255,255,255,0.07)',
}

// Legacy compat
export const COLORS = {
  bg:       C.black,
  surface:  C.glass,
  primary:  C.red,
  cyan:     C.mutedHi,
  green:    C.green,
  amber:    C.amber,
  orange:   '#FF6D00',
  red:      C.red,
  muted:    C.muted,
  border:   C.border,
}

export const ALERT_COLORS: Record<string, string> = {
  NORMAL:      C.green,
  ALERT:       C.amber,
  MINOR_FLOOD: '#FF6D00',
  MAJOR_FLOOD: C.red,
}

const glass = {
  background: `linear-gradient(135deg, ${C.glassMd} 0%, ${C.glass} 100%)`,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderTop:    `1px solid ${C.borderT}`,
  borderLeft:   `1px solid ${C.borderL}`,
  borderRight:  `1px solid ${C.borderS}`,
  borderBottom: `1px solid ${C.borderS}`,
  boxShadow: `0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)`,
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: C.black, paper: 'transparent' },
    primary:   { main: C.red },
    secondary: { main: C.amber },
    success:   { main: C.green },
    warning:   { main: C.amber },
    error:     { main: C.red },
    text: { primary: C.white, secondary: C.mutedHi },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    h1: { fontWeight: 800 }, h2: { fontWeight: 700 }, h3: { fontWeight: 700 },
    h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body {
          background: ${C.black};
          background-image:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(255,23,68,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(255,23,68,0.06) 0%, transparent 60%);
          background-attachment: fixed;
          min-height: 100vh;
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,23,68,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,23,68,0.5); }
        .leaflet-container { background: #000 !important; }
        .leaflet-popup-content-wrapper {
          background: rgba(0,0,0,0.92) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
          padding: 0 !important;
          color: #fff !important;
        }
        .leaflet-popup-tip { background: rgba(0,0,0,0.92) !important; }
        .leaflet-popup-close-button { color: rgba(255,255,255,0.5) !important; }
        .leaflet-control-zoom a {
          background: rgba(0,0,0,0.8) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
      `,
    },
    MuiPaper: { styleOverrides: { root: { ...glass, borderRadius: 16 } } },
    MuiCard:  { styleOverrides: { root: { ...glass, borderRadius: 16 } } },
    MuiAppBar: {
      styleOverrides: {
        root: {
          ...glass,
          background: `rgba(0,0,0,0.85)`,
          boxShadow: `0 1px 0 ${C.borderS}, 0 4px 24px rgba(0,0,0,0.5)`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRight: `1px solid ${C.borderS}`,
          borderRadius: '0 20px 20px 0',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: C.borderS, padding: '10px 14px' },
        head: {
          color: C.muted, fontWeight: 700, fontSize: '0.7rem',
          textTransform: 'uppercase', letterSpacing: '0.8px',
          background: 'rgba(0,0,0,0.3)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700, fontSize: '0.72rem', borderRadius: 8,
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          background: C.glass,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: C.glass,
          backdropFilter: 'blur(10px)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.borderL },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: alpha(C.red, 0.6) },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': { background: C.glass },
          '&.Mui-selected': { background: alpha(C.red, 0.12) },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 5 },
        bar: { borderRadius: 4 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { ...glass, borderRadius: 12 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${C.borderL}`,
          fontSize: '0.78rem',
          borderRadius: 8,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:hover': { background: C.glass },
          '&.Mui-selected': { background: alpha(C.red, 0.12) },
          '&.Mui-selected:hover': { background: alpha(C.red, 0.16) },
        },
      },
    },
  },
})
