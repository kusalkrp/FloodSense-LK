import { Box, Typography, Paper } from '@mui/material'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { Basin } from '../services/api'
import { C } from '../theme'

interface Props { basins: Basin[] }

function normalize(value: number, max: number) {
  return max <= 0 ? 0 : Math.round((value / max) * 100)
}
function shortName(name: string) {
  return name.replace('Ganga', 'G.').replace('River', 'R.').replace('Oya', 'O.').trim()
}

const BASIN_COLORS = [C.red, C.amber, C.blue, C.green]

export function BasinRadarChart({ basins }: Props) {
  if (basins.length === 0) return null

  const top = [...basins].sort((a, b) => (b.max_level_m ?? 0) - (a.max_level_m ?? 0)).slice(0, 4)
  const maxLevel   = Math.max(...top.map(b => b.max_level_m ?? 0), 0.01)
  const maxRising  = Math.max(...top.map(b => b.rising_count), 1)
  const maxAlert   = Math.max(...top.map(b => b.alert_count), 1)
  const maxStale   = Math.max(...top.map(b => b.stale_count), 1)
  const slugged    = top.map((b, i) => ({ ...b, slug: `b${i}`, short: shortName(b.basin) }))

  const radarData = [
    { metric: 'Max Level', ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.max_level_m ?? 0, maxLevel)])) },
    { metric: 'Rising',    ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.rising_count, maxRising)])) },
    { metric: 'At Alert',  ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.alert_count, maxAlert)])) },
    { metric: 'Offline',   ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.stale_count, maxStale)])) },
    { metric: 'Stations',  ...Object.fromEntries(slugged.map(b => [b.slug, Math.round(b.station_count / Math.max(...top.map(x => x.station_count), 1) * 100)])) },
  ]

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 4, position: 'relative' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.92rem' }}>Basin Risk Radar</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Normalised dimensions — top 4 basins (0–100)
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
          <PolarGrid stroke={C.borderL} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: '#fff', fontSize: 11, fontWeight: 500 }} />
          <PolarRadiusAxis angle={72} domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10 }} tickCount={4} axisLine={false} />
          {slugged.map((b, i) => (
            <Radar
              key={b.slug}
              name={b.short}
              dataKey={b.slug}
              stroke={BASIN_COLORS[i]}
              fill={BASIN_COLORS[i]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
              border: `1px solid ${C.borderL}`, borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            }}
            itemStyle={{ color: '#fff', fontWeight: 600 }}
            labelStyle={{ color: C.muted }}
            formatter={(v: number, name: string) => [`${v}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#fff', fontWeight: 500, paddingTop: 16 }}
            formatter={(value) => value} />
        </RadarChart>
      </ResponsiveContainer>
    </Paper>
  )
}
