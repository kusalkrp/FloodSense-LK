import { Paper, Typography, Box } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Basin } from '../services/api'
import { ALERT_COLORS, COLORS } from '../theme'

interface Props { basins: Basin[] }

export function BasinChart({ basins }: Props) {
  const data = basins
    .filter(b => b.avg_level_m != null && b.avg_level_m > 0)
    .map(b => ({
      name: b.basin.replace(' Ganga', '').replace(' Oya', '').slice(0, 14),
      avg: b.avg_level_m,
      alert: b.highest_alert,
    }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: '#6366f1', display: 'block' }}>
          Avg: {(payload[0]?.value ?? 0).toFixed(2)} m
        </Typography>
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Basin Average Water Levels
      </Typography>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} unit="m" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.muted }} width={60} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={ALERT_COLORS[entry.alert] ?? '#6366f1'} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  )
}
