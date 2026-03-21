import { useEffect, useRef } from 'react'
import { Paper, Box, Typography } from '@mui/material'
import { Station } from '../services/api'
import { ALERT_COLORS } from '../theme'

const STATION_COORDS: Record<string, [number, number]> = {
  "Norwood":[6.836,80.615],"Kithulgala":[6.989,80.413],"Deraniyagala":[6.924,80.337],
  "Glencourse":[6.977,80.173],"Holombuwa":[7.054,80.102],"Hanwella":[6.907,80.083],
  "Nagalagam Street":[6.930,79.865],"Rathnapura":[6.680,80.400],"Ellagawa":[6.618,80.283],
  "Putupaula":[6.725,80.330],"Magura":[6.550,80.317],"Kalawellawa (Millakanda)":[6.420,80.530],
  "Nawalapitiya":[7.058,80.535],"Peradeniya":[7.268,80.597],"Thaldena":[7.350,80.867],
  "Weraganthota":[7.635,80.967],"Manampitiya":[7.897,81.007],"Pitabeddara":[6.048,80.540],
  "Panadugama":[6.067,80.550],"Thalgahagoda":[6.100,80.650],"Urawa":[6.233,80.633],
  "Thawalama":[6.147,80.343],"Baddegama":[6.183,80.200],"Moraketiya":[6.317,80.900],
  "Giriulla":[7.333,80.133],"Badalgama":[7.483,79.950],"Dunamale":[7.304,80.170],
  "Thanthirimale":[8.467,80.483],"Galgamuwa":[8.007,80.267],"Moragaswewa":[7.927,80.457],
  "Wellawaya":[6.733,81.100],"Kuda Oya":[6.483,81.117],"Thanamalwila":[6.297,81.035],
  "Nakkala":[6.750,81.450],"Yaka Wewa":[8.217,80.200],"Padiyathalawa":[7.817,81.267],
  "Ampara":[7.299,81.672],"Siyambalanduwa":[7.022,81.486],"Katharagama":[6.414,81.333],
  "Horowpothana":[8.217,80.717],
}

interface Props { stations: Station[] }

export function StationMap({ stations }: Props) {
  const mapRef = useRef<{ map: any; L: any } | null>(null)
  const markersRef = useRef<any[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    import('leaflet').then(L => {
      const map = L.map(containerRef.current!, { zoomControl: true }).setView([7.4, 80.7], 7)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB', maxZoom: 18,
      }).addTo(map)
      mapRef.current = { map, L }
    })
    return () => { mapRef.current?.map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !stations.length) return
    const { map, L } = mapRef.current
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    stations.forEach(st => {
      const coords = STATION_COORDS[st.name]
      if (!coords) return
      const color = st.stale ? '#6366f1' : (ALERT_COLORS[st.alert_level] ?? '#10b981')
      const size = st.alert_level !== 'NORMAL' ? 14 : 10
      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 8px ${color}80;"></div>`,
        className: '', iconSize: [size, size], iconAnchor: [size/2, size/2],
      })
      const pct = st.pct != null ? `${st.pct.toFixed(1)}% of threshold` : ''
      const rate = st.rate != null ? `${st.rate > 0 ? '↑' : st.rate < 0 ? '↓' : '→'} ${Math.abs(st.rate).toFixed(3)} m/hr` : ''
      const popup = `<div style="font-family:Inter,sans-serif;font-size:13px;min-width:160px;color:#e2e8f0;background:#0d1117;padding:4px;">
        <strong style="font-size:14px;">${st.name}</strong><br>
        <span style="color:#888">${st.basin}</span>
        <hr style="border-color:#333;margin:4px 0">
        Level: <strong>${st.level_m != null ? st.level_m.toFixed(2)+'m' : '—'}</strong>${pct ? '<br>'+pct : ''}
        ${rate ? '<br>Rate: '+rate : ''}
        <br>Status: <strong style="color:${color}">${st.alert_level}</strong>
        ${st.stale ? '<br><span style="color:#f59e0b">⚠ Stale data</span>' : ''}
      </div>`
      const marker = L.marker(coords, { icon }).addTo(map)
      marker.bindPopup(popup, { className: 'dark-popup' })
      markersRef.current.push(marker)
    })
  }, [stations])

  return (
    <Paper sx={{ p: 0, overflow: 'hidden', height: 420 }}>
      <Box sx={{ p: 1.5, pb: 0 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
          Station Map — {stations.length} stations
        </Typography>
      </Box>
      <Box ref={containerRef} sx={{ height: 380, width: '100%' }} />
    </Paper>
  )
}
