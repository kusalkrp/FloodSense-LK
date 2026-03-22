import {
  Paper, Typography, Box, Table, TableHead, TableRow, TableCell,
  TableBody, LinearProgress, Tooltip
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Station } from '../services/api'
import { ALERT_COLORS, COLORS } from '../theme'
import { AlertBadge } from './AlertBadge'

interface Props {
  stations: Station[]
  title?: string
  limit?: number
  onSelectStation?: (name: string) => void
}

export function StationsTable({ stations, title = 'All Stations', limit, onSelectStation }: Props) {
  const rows = limit ? stations.slice(0, limit) : stations

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>{title}</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Station</TableCell>
              <TableCell>Basin</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>vs Threshold</TableCell>
              <TableCell>Rate</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(s => {
              const color = ALERT_COLORS[s.alert_level] ?? COLORS.green
              const pct = Math.min(s.pct ?? 0, 100)
              return (
                <TableRow
                  key={s.name}
                  onClick={() => onSelectStation?.(s.name)}
                  sx={{
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    cursor: onSelectStation ? 'pointer' : 'default',
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {s.stale && (
                        <Tooltip title="Stale data">
                          <WarningAmberIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                        </Tooltip>
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
                        {s.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{s.basin}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {s.level_m != null ? `${s.level_m.toFixed(2)}m` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          flex: 1, height: 6, borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 36 }}>
                        {pct.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ color: s.rate > 0.01 ? '#10b981' : s.rate < -0.01 ? '#ef4444' : 'text.secondary', fontWeight: 500 }}
                    >
                      {s.rate > 0 ? '↑' : s.rate < 0 ? '↓' : '→'} {Math.abs(s.rate).toFixed(3)}
                    </Typography>
                  </TableCell>
                  <TableCell><AlertBadge level={s.alert_level} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  )
}
