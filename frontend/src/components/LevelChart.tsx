import { Paper, Box, Typography } from '@mui/material'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Station } from '../services/api'
import { COLORS } from '../theme'

interface Props { stations: Station[] }

export function LevelChart({ stations }: Props) {
  // Top 5 stations by current level
  const top5 = [...stations]
    .filter(s => s.level_m != null && !s.stale)
    .sort((a, b) => (b.level_m ?? 0) - (a.level_m ?? 0))
    .slice(0, 5)

  const data = top5.map(s => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    level: s.level_m,
    rate: s.rate,
    alert: s.alert_level,
  }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
        {payload.map((p: any) => (
          <Typography key={p.dataKey} variant="caption" sx={{ color: p.color, display: 'block' }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
          </Typography>
        ))}
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Top Stations by Water Level
      </Typography>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.muted }} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} unit="m" />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone" dataKey="level" name="Level (m)"
            stroke="#6366f1" fill="url(#levelGrad)" strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Paper>
  )
}
