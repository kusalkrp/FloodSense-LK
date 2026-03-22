import { Box, Typography, Paper } from '@mui/material'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { Basin } from '../services/api'
import { COLORS } from '../theme'

interface Props { basins: Basin[] }

function normalize(value: number, max: number): number {
  return max <= 0 ? 0 : Math.round((value / max) * 100)
}

function shortName(name: string): string {
  return name.replace('Ganga', 'G.').replace('River', 'R.').replace('Oya', 'O.').trim()
}

const BASIN_COLORS = [COLORS.primary, COLORS.cyan, COLORS.amber, COLORS.green]

export function BasinRadarChart({ basins }: Props) {
  if (basins.length === 0) return null

  // Top 4 basins by max level for readability
  const top = [...basins]
    .sort((a, b) => (b.max_level_m ?? 0) - (a.max_level_m ?? 0))
    .slice(0, 4)

  const maxLevel = Math.max(...top.map(b => b.max_level_m ?? 0), 0.01)
  const maxRising = Math.max(...top.map(b => b.rising_count), 1)
  const maxAlert = Math.max(...top.map(b => b.alert_count), 1)
  const maxStale = Math.max(...top.map(b => b.stale_count), 1)

  // Use slug as key to avoid spaces in recharts dataKey
  const slugged = top.map((b, i) => ({ ...b, slug: `b${i}`, short: shortName(b.basin) }))

  const radarData = [
    { metric: 'Max Level',  ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.max_level_m ?? 0, maxLevel)])) },
    { metric: 'Rising',     ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.rising_count, maxRising)])) },
    { metric: 'At Alert',   ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.alert_count, maxAlert)])) },
    { metric: 'Offline',    ...Object.fromEntries(slugged.map(b => [b.slug, normalize(b.stale_count, maxStale)])) },
    { metric: 'Stations',   ...Object.fromEntries(slugged.map(b => [b.slug, Math.round(b.station_count / Math.max(...top.map(x => x.station_count), 1) * 100)])) },
  ]

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Basin Risk Radar</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Normalised dimensions across top 4 basins by level (0–100)
      </Typography>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
          <PolarGrid stroke={COLORS.border} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: COLORS.muted, fontSize: 11 }} />
          <PolarRadiusAxis
            angle={72}
            domain={[0, 100]}
            tick={{ fill: COLORS.muted, fontSize: 9 }}
            tickCount={4}
            axisLine={false}
          />
          {slugged.map((b, i) => (
            <Radar
              key={b.slug}
              name={b.short}
              dataKey={b.slug}
              stroke={BASIN_COLORS[i]}
              fill={BASIN_COLORS[i]}
              fillOpacity={0.12}
              strokeWidth={1.5}
            />
          ))}
          <Tooltip
            contentStyle={{ background: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
            labelStyle={{ color: COLORS.muted }}
            formatter={(v: number, name: string) => [`${v}`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: COLORS.muted, paddingTop: 8 }}
            formatter={(value) => value}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Paper>
  )
}
