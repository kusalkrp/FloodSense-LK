import { useState } from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  MenuItem, Select, TextField, FormControl, InputLabel, Chip
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { AlertBadge } from '../components/AlertBadge'
import { COLORS } from '../theme'

const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#6366f1', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626',
}

export function AlertsPage() {
  const [hours, setHours] = useState(24)
  const [severity, setSeverity] = useState('')
  const [basin, setBasin] = useState('')

  const { data } = useQuery({
    queryKey: ['alerts', hours, severity, basin],
    queryFn: () => api.alerts(hours, severity, basin),
    refetchInterval: 60000,
  })

  const alerts = data?.alerts ?? []

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Anomaly Events</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time window</InputLabel>
            <Select value={hours} label="Time window" onChange={e => setHours(Number(e.target.value))}>
              {[6, 24, 48, 168].map(h => <MenuItem key={h} value={h}>Last {h}h</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severity} label="Severity" onChange={e => setSeverity(String(e.target.value))}>
              <MenuItem value="">All</MenuItem>
              {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" label="Basin filter" value={basin}
            onChange={e => setBasin(e.target.value)}
            sx={{ width: 160 }}
          />
        </Box>
      </Box>

      <Paper>
        {alerts.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No anomaly events in the selected window.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Station</TableCell>
                <TableCell>Basin</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Z-score</TableCell>
                <TableCell>Rate×</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Explanation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map(a => (
                <TableRow key={a.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {new Date(a.detected_at).toLocaleString('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.station_name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{a.basin_name}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{a.anomaly_type}</TableCell>
                  <TableCell><AlertBadge level={a.severity} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {a.z_score != null ? a.z_score.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {a.rate_spike_ratio != null ? `${a.rate_spike_ratio.toFixed(1)}×` : '—'}
                  </TableCell>
                  <TableCell>
                    {a.risk_score != null ? (
                      <Chip
                        label={a.risk_score}
                        size="small"
                        sx={{
                          bgcolor: `${SEVERITY_COLORS[a.severity] ?? '#6366f1'}22`,
                          color: SEVERITY_COLORS[a.severity] ?? '#6366f1',
                          fontWeight: 700, fontSize: '0.75rem',
                        }}
                      />
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 260 }}>
                    {a.explanation}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Box sx={{ p: 1.5, borderTop: `1px solid ${COLORS.border}` }}>
          <Typography variant="caption" color="text.secondary">{alerts.length} events</Typography>
        </Box>
      </Paper>
    </Box>
  )
}
