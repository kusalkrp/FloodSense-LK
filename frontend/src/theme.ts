import { createTheme } from '@mui/material/styles'

export const COLORS = {
  bg: '#050914',
  surface: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  primary: '#6366f1',
  cyan: '#06b6d4',
  green: '#10b981',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  muted: 'rgba(255,255,255,0.45)',
}

export const ALERT_COLORS: Record<string, string> = {
  NORMAL: '#10b981',
  ALERT: '#f59e0b',
  MINOR_FLOOD: '#f97316',
  MAJOR_FLOOD: '#ef4444',
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: COLORS.bg, paper: COLORS.surface },
    primary: { main: COLORS.primary },
    secondary: { main: COLORS.cyan },
    success: { main: COLORS.green },
    warning: { main: COLORS.amber },
    error: { main: COLORS.red },
    text: { primary: '#e2e8f0', secondary: COLORS.muted },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: COLORS.surface,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${COLORS.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: COLORS.surface,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${COLORS.border}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.72rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: COLORS.border },
        head: { color: COLORS.muted, fontWeight: 500 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(5,9,20,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${COLORS.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(5,9,20,0.9)',
          backdropFilter: 'blur(16px)',
          borderRight: `1px solid ${COLORS.border}`,
        },
      },
    },
  },
})
