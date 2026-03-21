import { Grid, Box, Typography, Paper, Alert } from '@mui/material'
import ThermostatIcon from '@mui/icons-material/Thermostat'
import WaterIcon from '@mui/icons-material/Water'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningIcon from '@mui/icons-material/Warning'
import SensorsOffIcon from '@mui/icons-material/SensorsOff'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { StatCard } from '../components/StatCard'
import { StationMap } from '../components/StationMap'
import { LevelChart } from '../components/LevelChart'
import { RateChart } from '../components/RateChart'
import { BasinChart } from '../components/BasinChart'
import { KelaniCorridor } from '../components/KelaniCorridor'
import { StationsTable } from '../components/StationsTable'
import { COLORS } from '../theme'

export function DashboardPage() {
  const { data: stationsData } = useQuery({ queryKey: ['stations'], queryFn: api.stations, refetchInterval: 60000 })
  const { data: statusData } = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 30000 })
  const { data: basinsData } = useQuery({ queryKey: ['basins'], queryFn: api.basins, refetchInterval: 60000 })

  const stations = stationsData?.stations ?? []
  const dash = statusData?.dashboard
  const basins = basinsData?.basins ?? []

  const staleStations = stations.filter(s => s.stale)
  const updatedAt = dash?.updated_at
    ? new Date(dash.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Sri Lanka River Monitor</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last updated: {updatedAt}</Typography>
        </Box>
      </Box>

      {/* Stale warning */}
      {staleStations.length > 0 && (
        <Alert
          severity="warning" icon={<SensorsOffIcon />}
          sx={{ mb: 2, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
        >
          {staleStations.length} offline gauge{staleStations.length > 1 ? 's' : ''}: {staleStations.map(s => s.name).join(', ')}
        </Alert>
      )}

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Stations Monitored" value={dash?.stations_total ?? '—'} color={COLORS.primary} icon={<WaterIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Rising Now" value={dash?.stations_rising ?? 0} color={COLORS.amber} icon={<TrendingUpIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="At Alert Level" value={dash?.stations_alert ?? 0} color={COLORS.red} icon={<WarningIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Active Anomalies" value={dash?.anomalies_active ?? 0} color={COLORS.cyan} icon={<ThermostatIcon />} />
        </Grid>
      </Grid>

      {/* Map + Level chart */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={7}>
          <StationMap stations={stations} />
        </Grid>
        <Grid item xs={12} lg={5}>
          <LevelChart stations={stations} />
          <Box sx={{ mt: 2 }}>
            <RateChart stations={stations} />
          </Box>
        </Grid>
      </Grid>

      {/* Kelani + Basin */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <KelaniCorridor stations={stations} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BasinChart basins={basins} />
        </Grid>
      </Grid>

      {/* Full station table */}
      <StationsTable
        stations={[...stations].sort((a, b) => (b.level_m ?? 0) - (a.level_m ?? 0))}
        title={`All ${stations.length} Stations`}
      />
    </Box>
  )
}
