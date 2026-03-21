import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { AlertsPage } from './pages/AlertsPage'
import { SystemPage } from './pages/SystemPage'

export default function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Box>
  )
}
