import { useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography,
  Chip, CircularProgress, Grid
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Legend
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api, Station } from '../services/api'
import { ALERT_COLORS, COLORS } from '../theme'

interface Props {
  station: Station | null
  onClose: () => void
}

function fmt(ts: string) {
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export function StationDetailModal({ station, onClose }: Props) {
  const open = Boolean(station)

  const { data, isLoading } = useQuery({
    queryKey: ['station-history', station?.name],
    queryFn: () => api.stationHistory(station!.name, 48),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { chartData, forecastData } = useMemo(() => {
    const readings = data?.readings ?? []
    if (!readings.length) return { chartData: [], forecastData: [] }

    const history = readings.map(r => ({
      ts: fmt(r.timestamp),
      level: r.level_m,
      forecast: undefined as number | undefined,
    }))

    // Project 6h forward from the last reading using current rate
    const lastRate = station?.rate ?? 0
    const lastLevel = readings[readings.length - 1]?.level_m ?? 0
    const forecast = [
      { ts: history[history.length - 1]?.ts ?? '', level: undefined, forecast: lastLevel },
      { ts: '+2h', level: undefined, forecast: Math.max(0, lastLevel + lastRate * 2) },
      { ts: '+4h', level: undefined, forecast: Math.max(0, lastLevel + lastRate * 4) },
      { ts: '+6h', level: undefined, forecast: Math.max(0, lastLevel + lastRate * 6) },
    ]

    return { chartData: history, forecastData: forecast }
  }, [data, station?.rate])

  const combined = [...chartData, ...forecastData]
  const baseline = data?.baseline
  const alertColor = station ? (ALERT_COLORS[station.alert_level] ?? COLORS.green) : COLORS.green

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0a0f1e', border: `1px solid ${COLORS.border}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{station?.name}</Typography>
          <Typography variant="caption" color="text.secondary">{station?.basin}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {station && (
            <Chip
              label={station.alert_level}
              size="small"
              sx={{ bgcolor: `${alertColor}22`, color: alertColor, fontWeight: 700 }}
            />
          )}
          <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* Stats row */}
        {station && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Box sx={{ bgcolor: COLORS.surface, borderRadius: 2, p: 1.5, border: `1px solid ${COLORS.border}` }}>
                <Typography variant="caption" color="text.secondary">Current Level</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {station.level_m != null ? `${station.level_m.toFixed(2)}m` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ bgcolor: COLORS.surface, borderRadius: 2, p: 1.5, border: `1px solid ${COLORS.border}` }}>
                <Typography variant="caption" color="text.secondary">Rate of Rise</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: station.rate > 0.05 ? COLORS.green : station.rate < -0.05 ? COLORS.red : 'text.primary' }}>
                  {station.rate > 0 ? '↑' : station.rate < 0 ? '↓' : '→'} {Math.abs(station.rate).toFixed(3)} m/hr
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ bgcolor: COLORS.surface, borderRadius: 2, p: 1.5, border: `1px solid ${COLORS.border}` }}>
                <Typography variant="caption" color="text.secondary">6h Forecast</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {station.level_m != null
                    ? `${Math.max(0, station.level_m + station.rate * 6).toFixed(2)}m`
                    : '—'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Chart */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : combined.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No history data available from MCP server.</Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              48h Water Level History {baseline ? '+ Seasonal Baseline Band (±2σ)' : ''}
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={combined} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="ts" tick={{ fill: COLORS.muted, fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={v => `${v}m`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
                  labelStyle={{ color: COLORS.muted }}
                  formatter={(v: number, name: string) => [`${v?.toFixed(3)}m`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />

                {/* Baseline band */}
                {baseline && (
                  <ReferenceArea
                    y1={Math.max(0, baseline.avg_level_m - 2 * baseline.stddev_level_m)}
                    y2={baseline.avg_level_m + 2 * baseline.stddev_level_m}
                    fill={COLORS.cyan}
                    fillOpacity={0.08}
                    ifOverflow="extendDomain"
                  />
                )}
                {baseline && (
                  <ReferenceLine
                    y={baseline.avg_level_m}
                    stroke={COLORS.cyan}
                    strokeDasharray="6 3"
                    label={{ value: 'Baseline avg', fill: COLORS.cyan, fontSize: 11, position: 'insideTopLeft' }}
                  />
                )}

                {/* Historical level */}
                <Area
                  type="monotone"
                  dataKey="level"
                  name="Level (m)"
                  stroke={alertColor}
                  fill={`${alertColor}22`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />

                {/* 6h forecast */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="6h forecast"
                  stroke={COLORS.amber}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>

            {baseline && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Cyan band: seasonal baseline ±2σ (week of year) · Dashed amber: linear 6h projection from current rate
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
