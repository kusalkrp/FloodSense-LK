import { Paper, Typography, Box } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import { Station } from '../services/api'
import { C } from '../theme'

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

  const chartH = Math.max(280, data.length * 34 + 40)

  const tooltipStyle = {
    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.borderL}`, borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  }

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 3, position: 'relative' }}>
      <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, fontSize: '0.92rem' }}>
        Rate of Rise / Fall
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>All stations stable</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 68, left: -16, bottom: 4 }}>
            <defs>
              <linearGradient id="riseGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.7} />
                <stop offset="100%" stopColor={C.red} />
              </linearGradient>
              <linearGradient id="fallGrad" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor={C.blue} stopOpacity={0.7} />
                <stop offset="100%" stopColor={C.blue} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} horizontal={false} vertical={true} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: C.muted }}
              tickFormatter={v => `${v}`}
              label={{ value: 'm/hr', position: 'insideBottomRight', offset: -4, fill: C.muted, fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#fff', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke={C.borderL} strokeWidth={2} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#fff', fontWeight: 600 }}
              labelStyle={{ color: C.muted, marginBottom: 4 }}
              formatter={(v: number) => [`${v.toFixed(4)} m/hr`, 'Rate']}
            />
            <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={14}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.rate > 0 ? 'url(#riseGrad)' : 'url(#fallGrad)'} />
              ))}
              <LabelList
                dataKey="rate"
                position={data.some(d => d.rate < 0) ? 'top' : 'right'}
                formatter={(v: number) => `${v.toFixed(4)}`}
                style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
