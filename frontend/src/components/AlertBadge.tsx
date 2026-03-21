import { Chip } from '@mui/material'
import { ALERT_COLORS } from '../theme'

export function AlertBadge({ level }: { level: string }) {
  const color = ALERT_COLORS[level] ?? '#6366f1'
  const label = level.replace('_', ' ')
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color,
        border: `1px solid ${color}40`,
        fontWeight: 600,
        fontSize: '0.7rem',
      }}
    />
  )
}
