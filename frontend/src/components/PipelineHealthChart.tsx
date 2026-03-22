import { Box, Typography, Paper } from '@mui/material'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { COLORS } from '../theme'

function fmtTs(iso: string): string {
  const d = new Date(iso)
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${mo}/${dd} ${hh}:${mm}`
}

export function PipelineHealthChart() {
  const { data } = useQuery({
    queryKey: ['pipeline-runs'],
    queryFn: () => api.pipelineRuns(24),
    refetchInterval: 60000,
  })

  const runs = [...(data?.runs ?? [])].reverse().map(r => ({
    ts: fmtTs(r.started_at),
    anomalies: r.anomalies_found ?? 0,
    rising: r.rising_count ?? 0,
    duration: r.duration_ms != null ? Math.round(r.duration_ms / 1000) : null,
    failed: r.status === 'FAILED',
  }))

  if (runs.length === 0) return null

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Pipeline Health</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Anomalies detected &amp; run duration over last {runs.length} pipeline runs
      </Typography>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={runs} margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis
            dataKey="ts"
            tick={{ fill: COLORS.muted, fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            allowDecimals={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickFormatter={v => `${v}s`}
            width={36}
          />
          <Tooltip
            contentStyle={{ background: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
            labelStyle={{ color: COLORS.muted }}
            formatter={(v: number, name: string) =>
              name === 'Duration (s)' ? [`${v}s`, name] : [v, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
          <Bar yAxisId="left" dataKey="anomalies" name="Anomalies" fill={COLORS.amber} fillOpacity={0.75} maxBarSize={22} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="rising" name="Rising stations" fill={COLORS.cyan} fillOpacity={0.5} maxBarSize={22} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="duration"
            name="Duration (s)"
            stroke={COLORS.primary}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  )
}
