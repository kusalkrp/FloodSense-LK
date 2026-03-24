import { Box, Typography, Paper } from '@mui/material'
import { ReactNode } from 'react'
import { C } from '../theme'

interface Props {
  label: string
  value: string | number
  color?: string
  icon?: ReactNode
  sub?: string
}

export function StatCard({ label, value, color = C.red, icon, sub }: Props) {
  return (
    <Paper sx={{
      p: 2.5, position: 'relative', overflow: 'hidden',
      minHeight: 100,
      '&::before': {
        content: '""',
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
      },
    }}>
      {/* Glow blob */}
      <Box sx={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color, opacity: 0.08,
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {label}
        </Typography>
        {icon && (
          <Box sx={{
            width: 30, height: 30, borderRadius: '8px',
            bgcolor: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color, flexShrink: 0,
            '& svg': { fontSize: 16 },
          }}>
            {icon}
          </Box>
        )}
      </Box>

      <Typography sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#fff', mb: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.72rem', color: C.muted }}>{sub}</Typography>
      )}
    </Paper>
  )
}
