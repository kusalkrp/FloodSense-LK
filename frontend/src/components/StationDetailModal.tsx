import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, CircularProgress } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { Station } from '../services/api'
import { api } from '../services/api'
import { ALERT_COLORS, C } from '../theme'

interface Props {
  station: Station | null
  onClose: () => void
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export function StationDetailModal({ station, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['stationHistory', station?.name],
    queryFn: () => api.stationHistory(station!.name, 48),
    enabled: !!station,
  })

  const readings = data?.readings ?? []
  const baseline = data?.baseline
  const chartData = readings.map(r => ({
    t:     fmtTs(r.timestamp),
    level: r.level_m,
    rate:  r.rate,
  }))

  const color = station ? (ALERT_COLORS[station.alert_level] ?? C.green) : C.green

  const tooltipStyle = {
    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.borderL}`, borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  }

  return (
    <Dialog
      open={!!station} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(40px)',
          border: `1px solid ${C.borderL}`,
          borderRadius: 3,
          boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
        },
      }}
    >
      {station && (
        <>
          <DialogTitle sx={{ pb: 1, borderBottom: `1px solid ${C.borderS}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{station.name}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: C.muted }}>{station.basin} basin</Typography>
              </Box>
              <Chip
                label={station.alert_level}
                size="small"
                sx={{ bgcolor: `${color}18`, color, border: `1px solid ${color}30`, fontWeight: 700 }}
              />
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
            {/* Current stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {[
                { label: 'Current Level', value: station.level_m != null ? `${station.level_m.toFixed(3)} m` : '—', color: C.red },
                { label: 'Rate of Change', value: station.rate != null ? `${station.rate >= 0 ? '+' : ''}${station.rate.toFixed(4)} m/hr` : '—', color: station.rate > 0 ? C.red : C.blue },
                { label: 'Threshold', value: station.pct != null ? `${station.pct.toFixed(1)}%` : '—', color: C.amber },
                ...(baseline ? [{ label: 'Baseline Avg', value: `${baseline.avg_level_m.toFixed(3)} m`, color: C.mutedHi }] : []),
              ].map(stat => (
                <Box key={stat.label} sx={{
                  flex: '1 1 120px', p: 1.5, borderRadius: 2,
                  background: C.glass, border: `1px solid ${C.borderS}`,
                  backdropFilter: 'blur(10px)',
                }}>
                  <Typography sx={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                    {stat.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>
                    {stat.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Chart */}
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: C.mutedHi, mb: 1.5 }}>
              48-hour water level
            </Typography>
            {isLoading ? (
              <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} sx={{ color: C.red }} />
              </Box>
            ) : chartData.length === 0 ? (
              <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>No history available</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.borderS} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="m" />
                  {baseline && (
                    <ReferenceLine y={baseline.avg_level_m} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: 'avg', fill: C.amber, fontSize: 10, position: 'right' }} />
                  )}
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: C.muted }} />
                  <Line type="monotone" dataKey="level" name="Level (m)" stroke={color} strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: color }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </DialogContent>

          <DialogActions sx={{ borderTop: `1px solid ${C.borderS}`, px: 3, py: 2 }}>
            <Button onClick={onClose} sx={{ color: C.muted, '&:hover': { color: '#fff', bgcolor: C.glass } }}>
              Close
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
