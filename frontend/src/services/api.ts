const BASE = '/api/v1'

export interface Station {
  name: string
  basin: string
  level_m: number | null
  alert_level: 'NORMAL' | 'ALERT' | 'MINOR_FLOOD' | 'MAJOR_FLOOD'
  rate: number
  pct: number | null
  trend: string
  stale: boolean
}

export interface Dashboard {
  run_id: string
  updated_at: string
  monitoring_intensity: 'STANDARD' | 'ELEVATED' | 'HIGH_ALERT'
  stations_total: number
  stations_rising: number
  stations_alert: number
  anomalies_active: number
  alerts_sent_this_run: number
  errors: string[]
}

export interface AlertEvent {
  id: number
  station_name: string
  basin_name: string
  detected_at: string
  anomaly_type: string
  severity: string
  z_score: number | null
  rate_spike_ratio: number | null
  explanation: string
  risk_score: number | null
}

export interface Basin {
  basin: string
  station_count: number
  max_level_m: number | null
  avg_level_m: number | null
  rising_count: number
  alert_count: number
  stale_count: number
  highest_alert: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  stations: () => get<{ stations: Station[] }>('/stations/current'),
  status: () => get<{ dashboard: Dashboard; last_run_summary: string }>('/status'),
  alerts: (hours = 24, severity = '', basin = '') =>
    get<{ alerts: AlertEvent[] }>(`/alerts?hours=${hours}&severity=${severity}&basin=${encodeURIComponent(basin)}`),
  basins: () => get<{ basins: Basin[] }>('/basins'),
}
