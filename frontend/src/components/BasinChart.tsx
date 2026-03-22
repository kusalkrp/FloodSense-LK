import { Paper, Typography, Box } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts'
import { Basin } from '../services/api'
import { ALERT_COLORS, C } from '../theme'

interface Props { basins: Basin[] }

function shortName(n: string) {
  return n.replace(/\s*Ganga\b/i, ' G.').replace(/\s*River\b/i, ' R.').replace(/\s*Oya\b/i, ' O.').trim().slice(0, 16)
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <Box sx={{
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
      border: `1px solid ${C.borderL}`, borderRadius: 2, p: 1.5,
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
    }}>
      <Typography variant="caption" sx={{ color: '#fff', display: 'block', fontWeight: 700, mb: 0.5, fontSize: '0.82rem' }}>{d.fullName}</Typography>
      <Typography variant="caption" sx={{ color: C.red, display: 'block' }}>Avg: {d.avg} m</Typography>
      <Typography variant="caption" sx={{ color: C.mutedHi, display: 'block' }}>Max: {d.max} m</Typography>
      <Typography variant="caption" sx={{ color: C.muted, display: 'block', mt: 0.5 }}>
        {d.stations} station{d.stations !== 1 ? 's' : ''}
        {d.rising > 0 ? ` · ${d.rising} rising` : ''}
      </Typography>
    </Box>
  )
}

export function BasinChart({ basins }: Props) {
  const data = [...basins]
    .filter(b => b.avg_level_m != null && b.avg_level_m > 0)
    .sort((a, b) => (b.max_level_m ?? 0) - (a.max_level_m ?? 0))
    .map(b => ({
      name: shortName(b.basin),
      fullName: b.basin,
      avg: +(b.avg_level_m ?? 0).toFixed(3),
      max: +(b.max_level_m ?? 0).toFixed(3),
      alert: b.highest_alert,
      rising: b.rising_count,
      stations: b.station_count,
    }))

  const chartH = Math.max(300, data.length * 36 + 40)

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 4, position: 'relative' }}>
      <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, fontSize: '0.92rem' }}>
        Basin Average Levels
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>No basin data</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="basinGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.65} />
                <stop offset="100%" stopColor={C.red} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} horizontal={false} vertical={true} />
            <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} unit="m" domain={[0, 'auto']} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#fff', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="avg" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.alert === 'NORMAL' ? 'url(#basinGrad)' : (ALERT_COLORS[entry.alert] ?? C.red)} />
              ))}
              <LabelList dataKey="avg" position="right" formatter={(v: number) => `${v}m`}
                style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
