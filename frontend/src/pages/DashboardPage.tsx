import { useState } from 'react'
import { Grid, Box, Typography, Paper, Alert } from '@mui/material'
import WaterIcon from '@mui/icons-material/Water'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import SensorsOffIcon from '@mui/icons-material/SensorsOff'
import { useQuery } from '@tanstack/react-query'
import { api, Station } from '../services/api'
import { StatCard }           from '../components/StatCard'
import { StationMap }         from '../components/StationMap'
import { LevelChart }         from '../components/LevelChart'
import { RateChart }          from '../components/RateChart'
import { BasinChart }         from '../components/BasinChart'
import { BasinRadarChart }    from '../components/BasinRadarChart'
import { KelaniCorridor }     from '../components/KelaniCorridor'
import { StationsTable }      from '../components/StationsTable'
import { StationDetailModal } from '../components/StationDetailModal'
import { C } from '../theme'

export function DashboardPage() {
  const [selected, setSelected] = useState<Station | null>(null)

  const { data: sd } = useQuery({ queryKey: ['stations'], queryFn: api.stations, refetchInterval: 60000 })
  const { data: st } = useQuery({ queryKey: ['status'],   queryFn: api.status,   refetchInterval: 30000 })
  const { data: bd } = useQuery({ queryKey: ['basins'],   queryFn: api.basins,   refetchInterval: 60000 })

  const stations = sd?.stations ?? []
  const dash     = st?.dashboard
  const basins   = bd?.basins ?? []
  const stale    = stations.filter(s => s.stale)

  const updatedAt = dash?.updated_at
    ? new Date(dash.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const onSelect = (name: string) => setSelected(stations.find(s => s.name === name) ?? null)

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.1, color: '#fff' }}>
            River Monitor
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: C.muted, mt: 0.5 }}>
            Sri Lanka · {stations.length} stations · updated {updatedAt}
          </Typography>
        </Box>
        <Box sx={{
          px: 1.5, py: 0.6, borderRadius: '8px',
          background: `rgba(255,23,68,0.1)`,
          border: `1px solid rgba(255,23,68,0.25)`,
          fontSize: '0.7rem', fontWeight: 800, color: C.red,
          letterSpacing: '1px',
        }}>
          LIVE
        </Box>
      </Box>

      {/* Stale warning */}
      {stale.length > 0 && (
        <Alert
          severity="warning" icon={<SensorsOffIcon />}
          sx={{ mb: 2, bgcolor: `${C.amber}10`, border: `1px solid ${C.amber}30`, color: C.amber, borderRadius: 2 }}
        >
          {stale.length} offline: {stale.map(s => s.name).join(', ')}
        </Alert>
      )}

      {/* ── Row 1: Stat cards ───────────────────────────────────────────────── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Monitored" value={dash?.stations_total ?? '—'} color={C.red}    icon={<WaterIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Rising Now"  value={dash?.stations_rising ?? 0}  color={C.amber}  icon={<TrendingUpIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="At Alert"    value={dash?.stations_alert ?? 0}   color={C.red}    icon={<WarningAmberIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Anomalies"   value={dash?.anomalies_active ?? 0} color={C.blue}   icon={<BubbleChartIcon />} />
        </Grid>
      </Grid>

      {/* ── Row 2: Map + Kelani ─────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={8}>
          <StationMap stations={stations} onSelectStation={onSelect} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <KelaniCorridor stations={stations} />
        </Grid>
      </Grid>

      {/* ── Row 3: Level + Rate ─────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}><LevelChart stations={stations} /></Grid>
        <Grid item xs={12} md={6}><RateChart  stations={stations} /></Grid>
      </Grid>

      {/* ── Row 4: Basin + Radar ─────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}><BasinChart      basins={basins} /></Grid>
        <Grid item xs={12} md={6}><BasinRadarChart basins={basins} /></Grid>
      </Grid>

      {/* ── Row 5: Stations table ───────────────────────────────────────────── */}
      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <StationsTable
          stations={[...stations].sort((a, b) => (b.level_m ?? 0) - (a.level_m ?? 0))}
          title={`All ${stations.length} Stations`}
          onSelectStation={onSelect}
        />
      </Paper>

      <StationDetailModal station={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}
