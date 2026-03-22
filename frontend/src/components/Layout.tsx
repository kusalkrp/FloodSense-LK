import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Tooltip, Chip, Divider
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import WaterIcon from '@mui/icons-material/Water'
import MenuIcon from '@mui/icons-material/Menu'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { C } from '../theme'

const DRAWER_WIDTH = 230

const NAV = [
  { label: 'Dashboard',  path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Alerts',     path: '/alerts',    icon: <NotificationsActiveIcon /> },
  { label: 'System',     path: '/system',    icon: <MonitorHeartIcon /> },
]

const INTENSITY: Record<string, { color: string; label: string }> = {
  STANDARD:   { color: C.green,  label: 'Standard' },
  ELEVATED:   { color: C.amber,  label: 'Elevated' },
  HIGH_ALERT: { color: C.red,    label: 'High Alert' },
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate   = useNavigate()
  const { pathname } = useLocation()
  const { data } = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 30000 })
  const intensity = data?.dashboard?.monitoring_intensity ?? 'STANDARD'
  const intCfg    = INTENSITY[intensity] ?? INTENSITY.STANDARD

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 2 }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #FF1744 0%, #FF5252 100%)',
          boxShadow: '0 4px 16px rgba(255,23,68,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WaterIcon sx={{ fontSize: 20, color: '#fff' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.1, color: '#fff' }}>
            FloodSense
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: C.muted, lineHeight: 1 }}>
            Sri Lanka · Live
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: C.borderS, mx: 2, mb: 2 }} />

      {/* Nav items */}
      <List sx={{ px: 1.5, flexGrow: 1 }} dense>
        {NAV.map(({ label, path, icon }) => {
          const sel = pathname.startsWith(path)
          return (
            <ListItemButton
              key={path} selected={sel}
              onClick={() => { navigate(path); setMobileOpen(false) }}
              sx={{
                mb: 0.5, py: 1, px: 1.5,
                borderRadius: '12px',
                transition: 'all 0.18s ease',
                background: sel
                  ? 'linear-gradient(135deg, rgba(255,23,68,0.18) 0%, rgba(255,23,68,0.06) 100%)'
                  : 'transparent',
                border: sel ? `1px solid rgba(255,23,68,0.25)` : '1px solid transparent',
                boxShadow: sel ? '0 4px 16px rgba(255,23,68,0.12)' : 'none',
                '&:hover': {
                  background: sel
                    ? 'linear-gradient(135deg, rgba(255,23,68,0.22) 0%, rgba(255,23,68,0.08) 100%)'
                    : C.glass,
                  border: sel ? `1px solid rgba(255,23,68,0.35)` : `1px solid ${C.borderS}`,
                },
                '&.Mui-selected': { background: 'transparent' },
              }}
            >
              <ListItemIcon sx={{
                minWidth: 34, width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px', mr: 1.5,
                background: sel
                  ? 'linear-gradient(135deg, #FF1744 0%, #FF5252 100%)'
                  : C.glass,
                color: sel ? '#fff' : C.muted,
                boxShadow: sel ? '0 2px 10px rgba(255,23,68,0.4)' : 'none',
                transition: 'all 0.18s',
              }}>
                {React.cloneElement(icon as React.ReactElement, { sx: { fontSize: 16 } })}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontWeight: sel ? 700 : 500,
                  fontSize: '0.88rem',
                  color: sel ? '#fff' : C.mutedHi,
                }}
              />
              {sel && (
                <Box sx={{
                  width: 4, height: 4, borderRadius: '50%',
                  bgcolor: C.red, boxShadow: `0 0 6px ${C.red}`,
                }} />
              )}
            </ListItemButton>
          )
        })}
      </List>

      {/* Footer status */}
      <Divider sx={{ borderColor: C.borderS, mx: 2, mb: 2 }} />
      <Box sx={{ px: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiberManualRecordIcon sx={{ fontSize: 8, color: intCfg.color, filter: `drop-shadow(0 0 4px ${intCfg.color})` }} />
        <Typography sx={{ fontSize: '0.72rem', color: C.muted }}>
          {intCfg.label} monitoring
        </Typography>
      </Box>
    </Box>
  )

  return (
    <>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: t => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2, minHeight: '56px !important' }}>
          <IconButton size="small" onClick={() => setMobileOpen(!mobileOpen)} sx={{ display: { md: 'none' }, color: C.mutedHi }}>
            <MenuIcon />
          </IconButton>

          <Typography sx={{ flexGrow: 1, fontSize: '0.82rem', color: C.muted, fontWeight: 500 }}>
            Sri Lanka River Intelligence Network
          </Typography>

          <Chip
            icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important', color: `${intCfg.color} !important`, filter: `drop-shadow(0 0 3px ${intCfg.color})` }} />}
            label={intCfg.label}
            size="small"
            sx={{
              bgcolor: `${intCfg.color}15`,
              color: intCfg.color,
              border: `1px solid ${intCfg.color}30`,
              fontSize: '0.7rem', fontWeight: 700, height: 24,
            }}
          />

          <Tooltip title="Auto-refreshes every 60s">
            <Typography sx={{ fontSize: '0.7rem', color: C.muted, cursor: 'default' }}>LIVE</Typography>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH, flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}>
        {drawer}
      </Drawer>

      <Box component="main" sx={{
        flexGrow: 1,
        ml: { md: `${DRAWER_WIDTH}px` },
        mt: '56px',
        px: 2.5, pt: 2, pb: 4,
        minHeight: '100vh',
      }}>
        {children}
      </Box>
    </>
  )
}
