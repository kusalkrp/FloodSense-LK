import { Paper, Typography, Box, Chip } from '@mui/material'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Station } from '../services/api'
import { COLORS } from '../theme'

const CORRIDOR = [
  { key: 'Norwood',          label: 'Norwood',    etaH: 5.5 },
  { key: 'Kithulgala',       label: 'Kithulgala', etaH: 4.0 },
  { key: 'Deraniyagala',     label: 'Deraniya.',  etaH: 3.0 },
  { key: 'Glencourse',       label: 'Glencourse', etaH: 2.5 },
  { key: 'Holombuwa',        label: 'Holombuwa',  etaH: 2.0 },
  { key: 'Hanwella',         label: 'Hanwella',   etaH: 1.0 },
  { key: 'Nagalagam Street', label: 'Colombo',    etaH: 0.0 },
]

interface Props { stations: Station[] }

export function KelaniCorridor({ stations }: Props) {
  const stationMap = Object.fromEntries(stations.map(s => [s.name, s]))

  const data = CORRIDOR.map(c => {
    const s = stationMap[c.key]
    return {
      label: c.label,
      fullName: c.key,
      etaH: c.etaH,
      level: s && !s.stale && s.level_m != null ? +s.level_m.toFixed(3) : null,
      rate: s ? +(s.rate ?? 0).toFixed(4) : null,
      stale: s?.stale ?? false,
    }
  })

  const hasAny = data.some(d => d.level != null)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5, minWidth: 160 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>{d.fullName}</Typography>
        {d.level != null ? (
          <>
            <Typography variant="caption" sx={{ color: COLORS.cyan, display: 'block' }}>
              Level: {d.level.toFixed(2)} m
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: (d.rate ?? 0) > 0 ? COLORS.green : (d.rate ?? 0) < 0 ? COLORS.red : 'text.secondary', display: 'block' }}
            >
              Rate: {(d.rate ?? 0) > 0 ? '↑' : (d.rate ?? 0) < 0 ? '↓' : '→'} {Math.abs(d.rate ?? 0).toFixed(3)} m/hr
            </Typography>
          </>
        ) : (
          <Typography variant="caption" sx={{ color: COLORS.amber, display: 'block' }}>
            {d.stale ? '⚠ Stale / offline' : 'No data'}
          </Typography>
        )}
        {d.etaH > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {d.etaH}h upstream of Colombo
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Kelani Ganga Corridor</Typography>
        <Chip
          label="Norwood → Colombo  5.5 h"
          size="small"
          sx={{ fontSize: '0.68rem', color: 'text.secondary', bgcolor: 'rgba(99,102,241,0.08)' }}
        />
      </Box>

      {!hasAny ? (
        <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">No Kelani corridor data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.muted }} />
            <YAxis
              yAxisId="level"
              tick={{ fontSize: 11, fill: COLORS.muted }}
              unit="m"
              width={48}
              domain={['auto', 'auto']}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fontSize: 10, fill: COLORS.muted }}
              tickFormatter={v => `${v.toFixed(2)}`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="rate" y={0} stroke={COLORS.border} strokeDasharray="4 4" />
            {/* Rate bars */}
            <Bar
              yAxisId="rate"
              dataKey="rate"
              name="Rate (m/hr)"
              fill={COLORS.green}
              fillOpacity={0.35}
              maxBarSize={24}
              radius={[3, 3, 0, 0]}
            />
            {/* Level line */}
            <Line
              yAxisId="level"
              type="monotone"
              dataKey="level"
              name="Level (m)"
              stroke={COLORS.cyan}
              strokeWidth={2.5}
              dot={{ r: 5, fill: COLORS.cyan, stroke: 'rgba(6,182,212,0.35)', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: COLORS.cyan }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Blue line = water level (left axis) · Green bars = rate of rise (right axis)
      </Typography>
    </Paper>
  )
}
