import { Chip } from '@mui/material'
import { C } from '../theme'

const CFG: Record<string, { color: string; label: string }> = {
  LOW:      { color: C.blue,  label: 'Low' },
  MEDIUM:   { color: C.amber, label: 'Medium' },
  HIGH:     { color: '#FF6D00', label: 'High' },
  CRITICAL: { color: C.red,   label: 'Critical' },
}

export function AlertBadge({ level }: { level: string }) {
  const cfg = CFG[level] ?? { color: C.muted, label: level }
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}35`,
        fontWeight: 700, fontSize: '0.7rem', height: 22,
      }}
    />
  )
}
