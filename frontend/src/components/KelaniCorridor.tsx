import { Paper, Typography, Box, Chip } from '@mui/material'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Station } from '../services/api'
import { C } from '../theme'

const CORRIDOR = ['Norwood', 'Nawalapitiya', 'Kithulgala', 'Deraniyagala', 'Glencourse', 'Holombuwa', 'Hanwella', 'Nagalagam Street']

interface Props { stations: Station[] }

export function KelaniCorridor({ stations }: Props) {
  const data = CORRIDOR.map(name => {
    const st = stations.find(s => s.name === name)
    return {
      name: name.split(' ')[0],
      level: st && !st.stale && st.level_m != null ? +st.level_m.toFixed(3) : null,
      rate:  st && !st.stale && st.rate  != null ? +st.rate.toFixed(4) : null,
      stale: !st || st.stale,
    }
  }).filter(d => !d.stale)

  const tooltipStyle = {
    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.borderL}`, borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  }

  const active = data.filter(d => d.level != null).length

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 3, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>Kelani Corridor</Typography>
        <Chip label={`${active}/${CORRIDOR.length} live`} size="small"
          sx={{ bgcolor: `${C.green}18`, color: C.green, border: `1px solid ${C.green}30`, fontSize: '0.68rem', height: 20 }} />
      </Box>
      {data.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>No Kelani data</Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="m" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="" />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: '#fff', fontWeight: 600 }}
                labelStyle={{ color: C.muted, marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
              <Line yAxisId="left" type="monotone" dataKey="level" name="Level (m)"
                stroke={C.red} strokeWidth={2.5} dot={{ fill: C.red, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C.red, stroke: 'rgba(255,23,68,0.4)', strokeWidth: 4 }}
                connectNulls={false} />
              <Bar yAxisId="right" dataKey="rate" name="Rate (m/hr)"
                fill={C.amber} opacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={14} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}
