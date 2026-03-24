import { Box, Typography, Paper } from '@mui/material'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { C } from '../theme'

function fmtTs(ts: string) {
  const d = new Date(ts)
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const da = d.getDate().toString().padStart(2, '0')
  const hr = d.getHours().toString().padStart(2, '0')
  const mi = d.getMinutes().toString().padStart(2, '0')
  return `${mo}/${da} ${hr}:${mi}`
}

export function PipelineHealthChart() {
  const { data } = useQuery({ queryKey: ['pipelineRuns'], queryFn: () => api.pipelineRuns(20), refetchInterval: 60000 })
  const runs = (data?.runs ?? [])
    .filter(r => r.status === 'COMPLETED' && r.duration_ms != null)
    .slice(-15)
    .map(r => ({
      ts:         fmtTs(r.started_at),
      duration:   +(((r.duration_ms ?? 0) / 1000).toFixed(1)),
      anomalies:  r.anomalies_found ?? 0,
      stations:   r.stations_checked ?? 0,
    }))
    .reverse()

  const tooltipStyle = {
    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.borderL}`, borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  }

  return (
    <Paper sx={{ p: 2.5, pt: 2, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, fontSize: '0.92rem' }}>
        Pipeline Health
      </Typography>
      {runs.length === 0 ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>No runs yet</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={runs} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} />
            <XAxis dataKey="ts" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="s" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: C.muted, marginBottom: 4 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            <Line yAxisId="left" type="monotone" dataKey="duration" name="Duration (s)"
              stroke={C.red} strokeWidth={2} dot={false} />
            <Bar yAxisId="right" dataKey="anomalies" name="Anomalies"
              fill={C.amber} opacity={0.6} radius={[3, 3, 0, 0]} maxBarSize={16} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
