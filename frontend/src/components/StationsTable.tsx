import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  LinearProgress, Chip
} from '@mui/material'
import { Station } from '../services/api'
import { ALERT_COLORS, C } from '../theme'

interface Props {
  stations: Station[]
  title?: string
  onSelectStation?: (name: string) => void
}

export function StationsTable({ stations, title, onSelectStation }: Props) {
  return (
    <Box>
      {title && (
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderS}` }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{title}</Typography>
        </Box>
      )}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell>Station</TableCell>
              <TableCell>Basin</TableCell>
              <TableCell align="right">Level (m)</TableCell>
              <TableCell sx={{ minWidth: 120 }}>Threshold</TableCell>
              <TableCell align="right">Rate (m/hr)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Trend</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stations.map(st => {
              const color = ALERT_COLORS[st.alert_level] ?? C.red
              return (
                <TableRow
                  key={st.name}
                  onClick={() => onSelectStation?.(st.name)}
                  sx={{
                    cursor: onSelectStation ? 'pointer' : 'default',
                    opacity: st.stale ? 0.45 : 1,
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: C.glass },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff' }}>
                    {st.name}
                  </TableCell>
                  <TableCell sx={{ color: C.muted, fontSize: '0.78rem' }}>
                    {st.basin}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {st.level_m != null ? st.level_m.toFixed(3) : '—'}
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    {st.pct != null ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(st.pct, 100)}
                          sx={{
                            flex: 1,
                            '& .MuiLinearProgress-bar': { bgcolor: color },
                          }}
                        />
                        <Typography sx={{ fontSize: '0.72rem', color: C.muted, minWidth: 34, textAlign: 'right' }}>
                          {st.pct.toFixed(0)}%
                        </Typography>
                      </Box>
                    ) : <Typography sx={{ fontSize: '0.72rem', color: C.muted }}>—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{
                    fontFamily: 'monospace', fontSize: '0.82rem',
                    color: st.rate > 0 ? C.red : st.rate < 0 ? C.blue : C.muted,
                    fontWeight: st.rate !== 0 ? 700 : 400,
                  }}>
                    {st.rate != null ? (st.rate >= 0 ? '+' : '') + st.rate.toFixed(4) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={st.stale ? 'OFFLINE' : st.alert_level}
                      size="small"
                      sx={{
                        bgcolor: `${color}18`,
                        color: st.stale ? C.muted : color,
                        border: `1px solid ${color}30`,
                        fontSize: '0.68rem', fontWeight: 700, height: 20,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.82rem', color: C.muted }}>
                    {st.trend ?? '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${C.borderS}` }}>
        <Typography sx={{ fontSize: '0.72rem', color: C.muted }}>
          {stations.length} stations · click row for 48h history
        </Typography>
      </Box>
    </Box>
  )
}
