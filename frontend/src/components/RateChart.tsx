import { Paper, Typography, Box } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { Station } from '../services/api'
import { COLORS } from '../theme'

interface Props { stations: Station[] }

export function RateChart({ stations }: Props) {
  const data = [...stations]
    .filter(s => Math.abs(s.rate ?? 0) > 0.001 && !s.stale)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, 12)
    .map(s => ({
      name: s.name.length > 11 ? s.name.slice(0, 11) + '…' : s.name,
      rate: s.rate ?? 0,
    }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: payload[0]?.value > 0 ? '#10b981' : '#ef4444', display: 'block' }}>
          {(payload[0]?.value ?? 0) > 0 ? '↑' : '↓'} {Math.abs(payload[0]?.value ?? 0).toFixed(4)} m/hr
        </Typography>
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Rate of Rise / Fall (m/hr)
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">All stations stable</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.muted }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={COLORS.border} />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.rate > 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
