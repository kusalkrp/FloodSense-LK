import { Box, Typography, Paper, Grid, Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorIcon from '@mui/icons-material/Error'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { C } from '../theme'
import { PipelineHealthChart } from '../components/PipelineHealthChart'

function StatusCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Paper sx={{ p: 2.5, position: 'relative', overflow: 'hidden',
      '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)` },
    }}>
      <Box sx={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%',
        background: color, opacity: 0.07, filter: 'blur(25px)', pointerEvents: 'none' }} />
      <Typography sx={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '0.72rem', color: C.muted, mt: 0.5 }}>{sub}</Typography>}
    </Paper>
  )
}

export function SystemPage() {
  const { data: st } = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 15000 })
  const dash = st?.dashboard

  const staleStations: string[] = []
  for (const e of dash?.errors ?? []) {
    if (e.startsWith('stale_data:')) {
      const match = e.match(/\[(.+)\]/)
      if (match) staleStations.push(...match[1].split(',').map(s => s.trim().replace(/'/g, '')))
    }
  }
  const hardErrors = (dash?.errors ?? []).filter(e => !e.startsWith('stale_data:'))

  const intensity = dash?.monitoring_intensity ?? '—'
  const intColor  = intensity === 'HIGH_ALERT' ? C.red : intensity === 'ELEVATED' ? C.amber : C.green

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff' }}>System Health</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: C.muted, mt: 0.25 }}>Pipeline status · refreshes every 15s</Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={4}>
          <StatusCard label="Monitoring Mode" value={intensity} color={intColor} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatusCard label="Active Anomalies" value={dash?.anomalies_active ?? 0}
            color={dash?.anomalies_active ? C.amber : C.green}
            sub={dash?.anomalies_active ? 'Requires attention' : 'All clear'} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatusCard label="Offline Gauges" value={`${staleStations.length} / ${dash?.stations_total ?? 40}`}
            color={staleStations.length ? C.amber : C.green}
            sub={staleStations.length ? 'Hardware outage' : 'All online'} />
        </Grid>
      </Grid>

      {/* Offline gauges */}
      {staleStations.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 2, borderTop: `2px solid ${C.amber}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningAmberIcon sx={{ color: C.amber, fontSize: 18 }} />
            <Typography sx={{ color: C.amber, fontWeight: 700, fontSize: '0.85rem' }}>
              Offline Gauges ({staleStations.length})
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: C.muted, mb: 1.5 }}>
            No ArcGIS telemetry for 70+ minutes — hardware or connectivity outage.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {staleStations.map(s => (
              <Chip key={s} label={s} size="small"
                sx={{ bgcolor: `${C.amber}12`, color: C.amber, border: `1px solid ${C.amber}30`, fontSize: '0.72rem', height: 22 }} />
            ))}
          </Box>
        </Paper>
      )}

      {/* Hard errors */}
      {hardErrors.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 2, borderTop: `2px solid ${C.red}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ErrorIcon sx={{ color: C.red, fontSize: 18 }} />
            <Typography sx={{ color: C.red, fontWeight: 700, fontSize: '0.85rem' }}>Pipeline Errors</Typography>
          </Box>
          {hardErrors.map((e, i) => (
            <Typography key={i} sx={{ fontSize: '0.78rem', color: C.muted }}>{e}</Typography>
          ))}
        </Paper>
      )}

      {/* Pipeline chart */}
      <Box sx={{ mb: 2 }}>
        <PipelineHealthChart />
      </Box>

      {/* Last run summary */}
      <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <CheckCircleIcon sx={{ color: C.green, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', mb: 0.5 }}>
            Last Run Summary
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.6 }}>
            {st?.last_run_summary || 'No completed runs yet.'}
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
