import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Tooltip, Chip
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import NotificationsIcon from '@mui/icons-material/Notifications'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import WavesIcon from '@mui/icons-material/Waves'
import MenuIcon from '@mui/icons-material/Menu'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { COLORS } from '../theme'

const DRAWER_WIDTH = 220

const NAV = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Alerts', path: '/alerts', icon: <NotificationsIcon /> },
  { label: 'System', path: '/system', icon: <MonitorHeartIcon /> },
]

const INTENSITY_COLOR: Record<string, string> = {
  STANDARD: COLORS.green,
  ELEVATED: COLORS.amber,
  HIGH_ALERT: COLORS.red,
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data } = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 30000 })
  const intensity = data?.dashboard?.monitoring_intensity ?? 'STANDARD'

  const drawer = (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, mb: 3 }}>
        <WavesIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" sx={{ color: 'text.primary', fontSize: '1rem' }}>
          FloodSense LK
        </Typography>
      </Box>
      <List dense>
        {NAV.map(({ label, path, icon }) => (
          <ListItemButton
            key={path}
            selected={pathname.startsWith(path)}
            onClick={() => navigate(path)}
            sx={{
              mx: 1, borderRadius: 2, mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'rgba(99,102,241,0.15)',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
                '& .MuiListItemText-primary': { color: 'text.primary', fontWeight: 600 },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}>{icon}</ListItemIcon>
            <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            color="inherit"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '0.95rem', color: 'text.secondary' }}>
            Sri Lanka River Intelligence
          </Typography>
          <Chip
            label={intensity.replace('_', ' ')}
            size="small"
            sx={{
              bgcolor: `${INTENSITY_COLOR[intensity]}22`,
              color: INTENSITY_COLOR[intensity],
              border: `1px solid ${INTENSITY_COLOR[intensity]}44`,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
          <Tooltip title="Data refreshes every 60s">
            <IconButton size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, top: 0 },
          width: DRAWER_WIDTH, flexShrink: 0,
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, ml: { md: `${DRAWER_WIDTH}px` }, mt: '64px', px: 2.5, pt: 1.5, pb: 3, minHeight: '100vh' }}>
        {children}
      </Box>
    </>
  )
}
