import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Paper } from '@mui/material'
import { Station } from '../services/api'
import { ALERT_COLORS, C } from '../theme'

const COORDS: Record<string, [number, number]> = {
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

interface Props {
  stations: Station[]
  onSelectStation?: (name: string) => void
}

export function StationMap({ stations, onSelectStation }: Props) {
  const [mapReady, setMapReady] = useState(false)
  const mapRef      = useRef<{ map: any; L: any } | null>(null)
  const markersRef  = useRef<any[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !containerRef.current) return
      const map = L.map(containerRef.current, {
        zoomControl: true, attributionControl: false,
        zoomAnimation: true,
      }).setView([7.4, 80.7], 7)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map)
      mapRef.current = { map, L }
      setMapReady(true)
    })
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.map.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !mapReady || !stations.length) return
    const { map, L } = mapRef.current
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    stations.forEach(st => {
      const coords = COORDS[st.name]
      if (!coords) return
      const color   = st.stale ? '#4B5563' : (ALERT_COLORS[st.alert_level] ?? C.green)
      const isAlert = st.alert_level !== 'NORMAL' && !st.stale
      const size    = isAlert ? 14 : 10
      const icon    = L.divIcon({
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};
          border:2px solid ${isAlert ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'};
          box-shadow:0 0 ${isAlert ? 12 : 6}px ${color};
          cursor:pointer;
          transition:all 0.2s;
        "></div>`,
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      })
      const lvl  = st.level_m != null ? `${st.level_m.toFixed(3)} m` : 'N/A'
      const rate = st.rate    != null ? `${st.rate >= 0 ? '+' : ''}${st.rate.toFixed(4)} m/hr` : ''
      const popup = `
        <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:12px;min-width:170px;">
          <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:2px;">${st.name}</div>
          <div style="font-size:11px;color:#6B7280;margin-bottom:8px;">${st.basin ?? ''}</div>
          <div style="width:100%;height:1px;background:rgba(255,255,255,0.08);margin-bottom:8px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;color:#6B7280;">Level</span>
            <span style="font-size:13px;font-weight:700;color:#fff;">${lvl}</span>
          </div>
          ${rate ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;color:#6B7280;">Rate</span>
            <span style="font-size:11px;font-weight:600;color:${color};">${rate}</span>
          </div>` : ''}
          <div style="margin-top:8px;display:inline-block;padding:2px 8px;border-radius:6px;background:${color}20;border:1px solid ${color}40;color:${color};font-size:10px;font-weight:700;">
            ${st.stale ? 'OFFLINE' : st.alert_level}
          </div>
        </div>`
      const marker = L.marker(coords, { icon }).addTo(map)
      marker.bindPopup(popup, { className: '' })
      if (onSelectStation) marker.on('click', () => onSelectStation(st.name))
      markersRef.current.push(marker)
    })
  }, [stations, mapReady, onSelectStation])

  const alertCount = stations.filter(s => s.alert_level !== 'NORMAL' && !s.stale).length

  return (
    <Paper sx={{ overflow: 'hidden', height: 420, position: 'relative', p: 0 }}>
      {/* Header overlay */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 900,
        px: 2, py: 1.5,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
          Station Map
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: `${C.green}18`, border: `1px solid ${C.green}30`, color: C.green, fontSize: '0.68rem', fontWeight: 700 }}>
            {stations.filter(s => s.alert_level === 'NORMAL' && !s.stale).length} NORMAL
          </Box>
          {alertCount > 0 && (
            <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: `${C.red}18`, border: `1px solid ${C.red}30`, color: C.red, fontSize: '0.68rem', fontWeight: 700 }}>
              {alertCount} ALERT
            </Box>
          )}
        </Box>
      </Box>
      <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
    </Paper>
  )
}
