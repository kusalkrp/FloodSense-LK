import { Paper, Box, Typography } from '@mui/material'

interface Props {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, sub, color = '#e2e8f0', icon }: Props) {
  return (
    <Paper sx={{ p: 2.5, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        borderRadius: '0 12px 0 80px',
        bgcolor: `${color}10`,
      }} />
      {icon && (
        <Box sx={{ color, mb: 1, opacity: 0.8 }}>{icon}</Box>
      )}
      <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, fontSize: '0.8rem' }}>
        {label}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.6 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}
