import { Paper, Typography, Box, Chip } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Station } from '../services/api'
import { COLORS } from '../theme'

const CORRIDOR = [
  { name: 'Norwood', eta: 5.5 },
  { name: 'Kithulgala', eta: 4.0 },
  { name: 'Deraniyagala', eta: 3.0 },
  { name: 'Glencourse', eta: 2.5 },
  { name: 'Holombuwa', eta: 2.0 },
  { name: 'Hanwella', eta: 1.0 },
  { name: 'Nagalagam Street', eta: 0.0 },
]

interface Props { stations: Station[] }

export function KelaniCorridor({ stations }: Props) {
  const stationMap = Object.fromEntries(stations.map(s => [s.name, s]))

  const data = CORRIDOR.map(c => {
    const s = stationMap[c.name]
    return {
      name: c.name.replace(' Street', '').slice(0, 10),
      fullName: c.name,
      eta: c.eta,
      level: s?.level_m ?? null,
      rate: s?.rate ?? 0,
      alert: s?.alert_level ?? 'NORMAL',
      stale: s?.stale ?? false,
    }
  }).filter(d => d.level != null)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <Box sx={{ bgcolor: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>{d.fullName}</Typography>
        <Typography variant="caption" sx={{ color: '#06b6d4', display: 'block' }}>
          Level: {d.level?.toFixed(2)}m
        </Typography>
        <Typography variant="caption" sx={{ color: d.rate > 0 ? '#10b981' : '#ef4444', display: 'block' }}>
          Rate: {d.rate > 0 ? '↑' : '↓'} {Math.abs(d.rate).toFixed(3)} m/hr
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          ETA to Colombo: {d.eta}h
        </Typography>
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Kelani Ganga Corridor
        </Typography>
        <Chip label="Norwood → Colombo  5.5h" size="small" sx={{ fontSize: '0.7rem', color: 'text.secondary' }} />
      </Box>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="kelaniGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.muted }} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} unit="m" />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone" dataKey="level"
            stroke="url(#kelaniGrad)" strokeWidth={2.5}
            dot={{ r: 5, fill: '#6366f1', stroke: 'rgba(99,102,241,0.5)', strokeWidth: 2 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Rising upstream → Colombo flood warning lead time shown on X-axis
      </Typography>
    </Paper>
  )
}
