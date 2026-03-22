import { useState } from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  MenuItem, Select, TextField, FormControl, InputLabel, Chip
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { AlertBadge } from '../components/AlertBadge'
import { C } from '../theme'

const SEV_COLOR: Record<string, string> = {
  LOW: C.blue, MEDIUM: C.amber, HIGH: '#FF6D00', CRITICAL: C.red,
}

export function AlertsPage() {
  const [hours,    setHours]    = useState(24)
  const [severity, setSeverity] = useState('')
  const [basin,    setBasin]    = useState('')

  const { data } = useQuery({
    queryKey: ['alerts', hours, severity, basin],
    queryFn:  () => api.alerts(hours, severity, basin),
    refetchInterval: 60000,
  })
  const alerts = data?.alerts ?? []

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff' }}>Anomaly Events</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: C.muted, mt: 0.25 }}>
            {alerts.length} event{alerts.length !== 1 ? 's' : ''} in last {hours}h
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Window</InputLabel>
            <Select value={hours} label="Window" onChange={e => setHours(Number(e.target.value))}>
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
          <TextField size="small" label="Basin" value={basin}
            onChange={e => setBasin(e.target.value)} sx={{ width: 150 }} />
        </Box>
      </Box>

      <Paper sx={{ overflow: 'hidden' }}>
        {alerts.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '2rem', mb: 1 }}>🌊</Typography>
            <Typography sx={{ color: C.mutedHi, fontWeight: 600, mb: 0.5 }}>All clear</Typography>
            <Typography sx={{ color: C.muted, fontSize: '0.85rem' }}>No anomaly events in this window.</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Station</TableCell>
                  <TableCell>Basin</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell align="right">Z-score</TableCell>
                  <TableCell align="right">Rate×</TableCell>
                  <TableCell align="right">Risk</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>Explanation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map(a => (
                  <TableRow key={a.id} sx={{ '&:hover': { bgcolor: C.glass } }}>
                    <TableCell sx={{ fontSize: '0.75rem', color: C.muted, whiteSpace: 'nowrap' }}>
                      {new Date(a.detected_at).toLocaleString('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff', whiteSpace: 'nowrap' }}>
                      {a.station_name}
                    </TableCell>
                    <TableCell sx={{ color: C.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {a.basin_name}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: C.mutedHi }}>
                      {a.anomaly_type}
                    </TableCell>
                    <TableCell><AlertBadge level={a.severity} /></TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: a.z_score != null && a.z_score > 2 ? C.red : '#fff' }}>
                      {a.z_score != null ? a.z_score.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: a.rate_spike_ratio != null && a.rate_spike_ratio > 2 ? C.amber : '#fff' }}>
                      {a.rate_spike_ratio != null ? `${a.rate_spike_ratio.toFixed(1)}×` : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {a.risk_score != null ? (
                        <Chip
                          label={a.risk_score}
                          size="small"
                          sx={{
                            bgcolor: `${SEV_COLOR[a.severity] ?? C.blue}18`,
                            color:   SEV_COLOR[a.severity] ?? C.blue,
                            border:  `1px solid ${SEV_COLOR[a.severity] ?? C.blue}30`,
                            fontWeight: 700, fontSize: '0.72rem', height: 22,
                          }}
                        />
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: C.muted, maxWidth: 260 }}>
                      {a.explanation}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
