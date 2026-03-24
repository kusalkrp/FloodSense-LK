import { Paper, Typography, Box } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts'
import { Station } from '../services/api'
import { ALERT_COLORS, C } from '../theme'

interface Props { stations: Station[] }

export function LevelChart({ stations }: Props) {
  const data = [...stations]
    .filter(s => s.level_m != null && s.level_m > 0 && !s.stale)
    .sort((a, b) => (b.level_m ?? 0) - (a.level_m ?? 0))
    .slice(0, 12)
    .map(s => ({
      name: s.name.length > 15 ? s.name.slice(0, 14) + '…' : s.name,
      level: +(s.level_m ?? 0).toFixed(3),
      alert: s.alert_level,
    }))

  const chartH = Math.max(280, data.length * 34 + 40)

  const tooltipStyle = {
    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.borderL}`, borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  }

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 3, position: 'relative' }}>
      <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, fontSize: '0.92rem' }}>
        Top Water Levels
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>No data</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: -16, bottom: 4 }}>
            <defs>
              <linearGradient id="lvlGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.7} />
                <stop offset="100%" stopColor={C.red} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} horizontal={false} vertical={true} />
            <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} unit="m" domain={[0, 'auto']} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11, fill: '#fff', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#fff', fontWeight: 600 }}
              labelStyle={{ color: C.muted, marginBottom: 4 }}
              formatter={(v: number) => [`${v} m`, 'Level']}
            />
            <Bar dataKey="level" radius={[0, 6, 6, 0]} maxBarSize={14}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.alert === 'NORMAL' ? 'url(#lvlGrad)' : (ALERT_COLORS[entry.alert] ?? C.red)} />
              ))}
              <LabelList dataKey="level" position="right" formatter={(v: number) => `${v}m`}
                style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
