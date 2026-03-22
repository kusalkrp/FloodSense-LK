import { Paper, Typography, Box } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Basin } from '../services/api'
import { ALERT_COLORS, COLORS } from '../theme'

interface Props { basins: Basin[] }

function shortBasinName(name: string): string {
  return name
    .replace(/\s*Ganga\b/i, ' G.')
    .replace(/\s*River\b/i, ' R.')
    .replace(/\s*Oya\b/i,   ' O.')
    .trim()
    .slice(0, 16)
}

export function BasinChart({ basins }: Props) {
  const data = [...basins]
    .filter(b => b.avg_level_m != null && b.avg_level_m > 0)
    .sort((a, b) => (b.max_level_m ?? 0) - (a.max_level_m ?? 0))
    .map(b => ({
      name: shortBasinName(b.basin),
      fullName: b.basin,
      avg: +(b.avg_level_m ?? 0).toFixed(3),
      max: +(b.max_level_m ?? 0).toFixed(3),
      alert: b.highest_alert,
      rising: b.rising_count,
      stations: b.station_count,
    }))

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.primary', display: 'block', fontWeight: 600, mb: 0.5 }}>
          {d.fullName}
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.primary, display: 'block' }}>
          Avg level: {d.avg} m
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.cyan, display: 'block' }}>
          Max level: {d.max} m
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {d.stations} station{d.stations !== 1 ? 's' : ''}
          {d.rising > 0 ? ` · ${d.rising} rising` : ''}
        </Typography>
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Basin Average Water Levels
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">No basin data</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 34 + 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} unit="m" domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11, fill: COLORS.muted }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avg" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={ALERT_COLORS[entry.alert] ?? COLORS.primary} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey="avg"
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
