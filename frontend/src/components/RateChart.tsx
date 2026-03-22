import { Paper, Typography, Box } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import { Station } from '../services/api'
import { COLORS } from '../theme'

interface Props { stations: Station[] }

export function RateChart({ stations }: Props) {
  const data = [...stations]
    .filter(s => Math.abs(s.rate ?? 0) > 0.002 && !s.stale)
    .sort((a, b) => Math.abs(b.rate ?? 0) - Math.abs(a.rate ?? 0))
    .slice(0, 10)
    .map(s => ({
      name: s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name,
      rate: +(s.rate ?? 0).toFixed(4),
    }))

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Rate of Rise / Fall
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">All stations stable</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32 + 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: COLORS.muted }}
              tickFormatter={v => `${v.toFixed(3)}`}
              label={{ value: 'm/hr', position: 'insideBottomRight', offset: -4, fill: COLORS.muted, fontSize: 10 }}
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: COLORS.muted }} />
            <ReferenceLine x={0} stroke={COLORS.border} strokeWidth={1.5} />
            <Tooltip
              contentStyle={{ background: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
              labelStyle={{ color: COLORS.muted }}
              formatter={(v: number) => [
                `${v > 0 ? '↑' : '↓'} ${Math.abs(v).toFixed(4)} m/hr`,
                'Rate',
              ]}
            />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.rate > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey="rate"
                position="right"
                formatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(3)}`}
                style={{ fill: COLORS.muted, fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
