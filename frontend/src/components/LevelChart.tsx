import { Paper, Box, Typography } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Station } from '../services/api'
import { ALERT_COLORS, COLORS } from '../theme'

interface Props { stations: Station[] }

export function LevelChart({ stations }: Props) {
  const data = [...stations]
    .filter(s => s.level_m != null && !s.stale)
    .sort((a, b) => (b.level_m ?? 0) - (a.level_m ?? 0))
    .slice(0, 10)
    .map(s => ({
      name: s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name,
      level: s.level_m,
      alert: s.alert_level,
      pct: s.pct ?? 0,
    }))

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Top Stations by Water Level
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">No level data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32 + 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} unit="m" domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: COLORS.muted }} />
            <Tooltip
              contentStyle={{ background: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
              labelStyle={{ color: COLORS.muted }}
              formatter={(v: number) => [`${v.toFixed(3)} m`, 'Level']}
            />
            <Bar dataKey="level" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={ALERT_COLORS[entry.alert] ?? COLORS.primary} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey="level"
                position="right"
                formatter={(v: number) => `${v.toFixed(2)}m`}
                style={{ fill: COLORS.muted, fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
