import { Box, Typography, Paper, Grid, Chip } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { COLORS } from '../theme'
import { PipelineHealthChart } from '../components/PipelineHealthChart'

export function SystemPage() {
  const { data: statusData } = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 15000 })
  const dash = statusData?.dashboard

  // Extract stale stations from errors array
  const staleStations: string[] = []
  for (const e of dash?.errors ?? []) {
    if (e.startsWith('stale_data:')) {
      try {
        const match = e.match(/\[(.+)\]/)
        if (match) staleStations.push(...match[1].split(',').map(s => s.trim().replace(/'/g, '')))
      } catch {
        // ignore parse errors
      }
    }
  }
  const hardErrors = (dash?.errors ?? []).filter(e => !e.startsWith('stale_data:'))

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>System Health</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary">Monitoring Intensity</Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700 }}>
              {dash?.monitoring_intensity ?? '—'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary">Active Anomalies</Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700, color: dash?.anomalies_active ? COLORS.amber : COLORS.green }}>
              {dash?.anomalies_active ?? 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary">Offline Gauges</Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700, color: staleStations.length ? COLORS.amber : COLORS.green }}>
              {staleStations.length} / {dash?.stations_total ?? 40}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {staleStations.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderColor: 'rgba(245,158,11,0.3)' }}>
          <Typography variant="subtitle2" sx={{ color: COLORS.amber, mb: 1 }}>
            Offline Gauges ({staleStations.length})
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            No ArcGIS telemetry received for 70+ minutes. Likely hardware/connectivity outage at gauge sites.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {staleStations.map(s => (
              <Chip key={s} label={s} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: COLORS.amber, border: '1px solid rgba(245,158,11,0.3)' }} />
            ))}
          </Box>
        </Paper>
      )}

      {hardErrors.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderColor: 'rgba(239,68,68,0.3)' }}>
          <Typography variant="subtitle2" sx={{ color: COLORS.red, mb: 1 }}>Pipeline Errors</Typography>
          {hardErrors.map((e, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>{e}</Typography>
          ))}
        </Paper>
      )}

      <Box sx={{ mb: 2 }}>
        <PipelineHealthChart />
      </Box>

      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${COLORS.border}` }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Last Run Summary</Typography>
          <Typography variant="caption" color="text.secondary">{statusData?.last_run_summary || 'No runs yet'}</Typography>
        </Box>
      </Paper>
    </Box>
  )
}
