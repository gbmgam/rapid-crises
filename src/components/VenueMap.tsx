import { useState, useRef, useEffect, useMemo, MouseEvent } from 'react';
import { 
  Navigation, 
  MapPin, 
  Layers, 
  Search, 
  Compass, 
  ShieldAlert,
  ChevronRight,
  Info,
  X,
  Users,
  Eye,
  Activity,
  Square as Selection,
  BrainCircuit,
  Zap,
  Flag,
  Accessibility,
  AlertTriangle,
  Stethoscope,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import AROverlay from './AROverlay';
import { useNotify } from '../contexts/NotificationContext';
import { useTactical } from '../contexts/TacticalContext';
import { navBus } from '../lib/navBus';
import { TacticalAudio } from '../lib/audio';

import MFADialog from './MFADialog';
import { useAuth } from '../contexts/AuthContext';

export default function VenueMap({ minimal = false }: { minimal?: boolean }) {
  const { isOnline } = useNotify();
  const { logAuditAction, profile } = useAuth();
  const { 
    dangerZones, 
    optimalRoute, 
    isScanning, 
    scanForHazards, 
    isSafe, 
    sensors, 
    blockedNodes, 
    blockNode,
    userLocation,
    safeZones,
    nearestSafeZone,
    distanceToNearestMeters,
    isInsideSafeZone,
    prediction
  } = useTactical();
  
  const [activeFloor, setActiveFloor] = useState('G');
  
  // Coordinate Mapping logic (lat/lng to map percentage)
  const mapLatLngToXY = (lat: number, lng: number) => {
    const minLat = 40.7115;
    const maxLat = 40.7145;
    const minLng = -74.0090;
    const maxLng = -74.0050;
    
    // Simple linear projection for the digital twin overlay
    let x = ((lng - minLng) / (maxLng - minLng)) * 100;
    let y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    
    // Clamp to 5-95% to stay within building bounds visually
    x = Math.max(5, Math.min(95, x));
    y = Math.max(5, Math.min(95, y));
    
    return { x, y };
  };

  const userXY = useMemo(() => {
    if (!userLocation) return { x: 50, y: 50 };
    return mapLatLngToXY(userLocation.lat, userLocation.lng);
  }, [userLocation]);

  const mappedSafeZones = useMemo(() => {
    return safeZones.map(zone => ({
      ...zone,
      ...mapLatLngToXY(zone.location.lat, zone.location.lng)
    }));
  }, [safeZones]);

  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [arMode, setArMode] = useState<'evacuation' | 'responder' | null>(null);
  const [isSyncingAR, setIsSyncingAR] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleSecureBlockNode = (nodeId: string) => {
    setPendingAction(() => async () => {
      blockNode(nodeId);
      await logAuditAction('BLOCK_NODE', { nodeId, floor: activeFloor });
      TacticalAudio.playAlert();
    });
    setMfaOpen(true);
  };

  const pins = useMemo(() => [
    { 
      id: 'start', floor: 'G', label: 'Main Lobby', x: 50, y: 50, type: 'node', 
      desc: 'Central junction for guest ingress. High occupancy anticipated.', 
      status: 'Active', connectivity: '98%', battery: '100%' 
    },
    { 
      id: 'hub_a', floor: 'G', label: 'Hub Sector Alpha', x: 25, y: 30, type: 'node', 
      desc: 'Tactical responder station. Contains AED and first-aid ordnance.', 
      status: 'Manned', connectivity: '100%', battery: 'Backup Active' 
    },
    { 
      id: 'hub_b', floor: 'G', label: 'Hub Sector Beta', x: 75, y: 30, type: 'node', 
      desc: 'Acoustic monitoring enabled gateway.', 
      status: 'Standby', connectivity: '92%', battery: '85%' 
    },
    { 
      id: 'exit_1', floor: 'G', label: 'Strategy Exit 1', x: 90, y: 15, type: 'exit', 
      desc: 'Pressurized escape corridor. Direct link to LZ Alpha.', 
      status: 'Locked', connectivity: '100%', battery: 'N/A' 
    },
    { 
      id: 'exit_2', floor: 'G', label: 'Priority Exit 2', x: 10, y: 15, type: 'exit', 
      desc: 'Secondary triage zone. Medical personnel on standby.', 
      status: 'Operational', connectivity: '95%', battery: '90%' 
    },
  ], []);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const startAR = (mode: 'evacuation' | 'responder') => {
    TacticalAudio.playBlip(1800, 0.05);
    setArMode(mode);
    setIsSyncingAR(true);
    setTimeout(() => {
      setIsSyncingAR(false);
      TacticalAudio.playConfirm();
    }, 1500);
  };

  const hotspots = [
    { x: 30, y: 40, size: 40, intensity: 'low' },
    { x: 60, y: 25, size: 60, intensity: 'high' },
    { x: 80, y: 70, size: 30, intensity: 'med' },
  ];

  const floors = ['B2', 'B1', 'G', '1', '2', '3'];

  const currentPins = useMemo(() => pins.filter(p => p.floor === activeFloor), [pins, activeFloor]);

  useEffect(() => {
    return navBus.on((target) => {
      let pinToSelect = null;
      
      if (target === 'reset') {
        setSelectedPin(null);
        setIsNavigating(false);
        return;
      }

      if (target === 'lobby') pinToSelect = pins.find(p => p.label === 'Main Lobby');
      if (target === 'exit') pinToSelect = pins.find(p => p.label === 'Fire Exit 1');
      if (target === 'security_a') pinToSelect = pins.find(p => p.label === 'Security Node A');
      if (target === 'medical') pinToSelect = pins.find(p => p.label === 'Medical Hub');

      if (pinToSelect) {
        setActiveFloor(pinToSelect.floor);
        setSelectedPin(pinToSelect);
        setIsNavigating(true);
        setTimeout(() => setIsNavigating(false), 8000);
      }
    });
  }, [pins]);

  const hazardsCount = hotspots.length;

  return (
    <div className={cn("animate-in fade-in duration-500 h-full flex flex-col", minimal ? "gap-0" : "space-y-6")}>
      {!minimal && (
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
               <span className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                 <Navigation className="w-8 h-8 text-indigo-400" />
               </span>
               DIGITAL_TWIN
            </h1>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.4em] mt-1">Status: <span className={cn(isSafe ? "text-emerald-400" : "text-amber-400")}>{isSafe ? "SECURE" : "ADVISORY"}</span> • Node: <span className="text-slate-300 italic">SECTOR_G_LOBBY</span></p>
          </div>
          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800 backdrop-blur-md">
            {floors.map(f => (
              <button
                key={f}
                onClick={() => {
                  TacticalAudio.playBlip(1200, 0.02);
                  setActiveFloor(f);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl font-black text-[10px] transition-all duration-300 uppercase tracking-widest",
                  activeFloor === f 
                    ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                LEVEL_{f}
              </button>
            ))}
          </div>
        </header>
      )}

      <div 
        className={cn(
          "flex-1 relative bg-slate-950 border rounded-[2.5rem] overflow-hidden group perspective-1000 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]",
          minimal ? "border-transparent rounded-none" : "border-slate-800/50"
        )}
        ref={mapRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
      >
        <motion.div 
           className="w-full h-full p-12 flex items-center justify-center relative"
           animate={{ 
             rotateY: mousePos.x * 12,
             rotateX: -mousePos.y * 12,
             scale: 1.02
           }}
           transition={{ type: 'spring', stiffness: 100, damping: 30 }}
        >
          {/* Map Layers */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:48px:48px] opacity-20" />
          
          {/* High Risk Overlay pulsate */}
          {prediction.riskLevel === 'high' && (
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1], border: ['2px solid #ef4444', '8px solid #ef4444', '2px solid #ef4444'] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 z-10 pointer-events-none rounded-[2rem]"
            />
          )}

          {/* Crowd Density & Danger Zones */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {(isSafe ? [
               { x: 50, y: 50, radius: 40, severity: 'safe' },
               { x: 20, y: 20, radius: 25, severity: 'safe' },
               { x: 80, y: 80, radius: 25, severity: 'safe' }
             ] : (dangerZones.length > 0 ? dangerZones : [
               { x: 30, y: 40, radius: 20, severity: 'low' },
               { x: 60, y: 25, radius: 30, severity: 'high' }
             ])).map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0.1, 0.4, 0.1], scale: 1 }}
                  transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
                  className={cn(
                     "absolute rounded-full blur-3xl",
                     h.severity === 'high' ? "bg-red-500/25" : 
                     h.severity === 'safe' ? "bg-emerald-500/15" :
                     h.severity === 'medium' ? "bg-amber-500/15" : "bg-indigo-500/10"
                  )}
                  style={{ 
                     left: `${h.x}%`, 
                     top: `${h.y}%`, 
                     width: `${(h.radius || 30) * 4}px`, 
                     height: `${(h.radius || 30) * 4}px`,
                     transform: 'translate(-50%, -50%)'
                  }}
                />
             ))}
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="w-full h-full relative">
              <svg viewBox="0 0 1000 400" className="w-full h-full text-slate-800 fill-slate-900/20 stroke-slate-800 stroke-[0.5]">
                <rect x="50" y="50" width="900" height="300" rx="20" />
                <path d="M 500,50 L 500,350 M 50,200 L 950,200" strokeDasharray="4 4" />
              </svg>
              <AnimatePresence mode="popLayout">
                {mappedSafeZones.map((zone) => (
                  <motion.button
                    key={zone.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => {
                      TacticalAudio.playConfirm();
                      setSelectedPin({
                        ...zone,
                        label: zone.name,
                        desc: `${zone.type.toUpperCase()} node with ${zone.radius_meters}m safety radius. ${zone.is_accessible ? "Accessible uplink." : "Stairwell primary."}`,
                        status: zone.is_closed ? 'CLOSED' : 'SECURE',
                        connectivity: '100%'
                      });
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group/pin z-20"
                    style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                  >
                    <div className={cn(
                      "relative w-8 h-8 rounded-xl border border-slate-950 flex items-center justify-center transition-all shadow-xl backdrop-blur-md",
                      zone.is_closed ? "bg-red-900/80 border-red-500 shadow-red-500/20" : "bg-emerald-600/80 border-emerald-400 shadow-emerald-500/20 hover:scale-110"
                    )}>
                      {zone.type === 'exit' && <Flag className="w-4 h-4 text-white" />}
                      {zone.type === 'security' && <ShieldCheck className="w-4 h-4 text-white" />}
                      {zone.type === 'medical' && <Stethoscope className="w-4 h-4 text-white" />}
                      {zone.type === 'shelter' && <ShieldAlert className="w-4 h-4 text-white" />}
                      
                      {zone.is_closed && (
                        <div className="absolute inset-0 flex items-center justify-center">
                           <X className="w-6 h-6 text-red-500 opacity-60" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}

                {currentPins.map((pin) => (
                  <motion.button
                    key={pin.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => {
                      TacticalAudio.playConfirm();
                      setSelectedPin(pin);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group/pin"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <div className={cn(
                      "relative w-7 h-7 rounded-lg border border-slate-950 flex items-center justify-center transition-all shadow-lg",
                      blockedNodes.has(pin.id as string) ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" :
                      pin.type === 'security' ? "bg-indigo-600" : pin.type === 'exit' ? "bg-emerald-600" : "bg-slate-700"
                    )}>
                      {blockedNodes.has(pin.id as string) ? <X className="w-4 h-4 text-white" /> :
                       pin.type === 'security' ? <ShieldAlert className="w-3.5 h-3.5 text-white" /> : 
                       pin.type === 'exit' ? <Flag className="w-3.5 h-3.5 text-white" /> :
                       <MapPin className="w-3.5 h-3.5 text-white" />}
                      
                      {blockedNodes.has(pin.id as string) && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-slate-950 flex items-center justify-center">
                          <Zap className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}

                {/* Sensor Mesh Markers */}
                {sensors.map((sensor) => (
                  <motion.div
                    key={sensor.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${sensor.location.x}%`, top: `${sensor.location.y}%` }}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 border-slate-950 flex items-center justify-center relative",
                       sensor.status === 'ALERT' ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-indigo-500/50"
                    )}>
                       <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Optimal Path Visualization */}
              {optimalRoute && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 400" preserveAspectRatio="none">
                  <motion.path
                    d={`M ${optimalRoute.map(p => `${p.x * 10} ${p.y * 4}`).join(' L ')}`}
                    fill="none"
                    stroke="#3b82f6" // Blue line as per requirement 7.1
                    strokeWidth="4"
                    strokeDasharray="10 10"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 2, ease: "linear" }}
                  />
                  {/* Dynamic Glowing Pulse along the path */}
                  <motion.circle r="6" fill="#3b82f6">
                    <animateMotion 
                      dur="2s" 
                      repeatCount="indefinite" 
                      path={`M ${optimalRoute.map(p => `${p.x * 10} ${p.y * 4}`).join(' L ')}`} 
                    />
                  </motion.circle>
                </svg>
              )}

              {/* User Location Dot with Accuracy Circle */}
              {userLocation && (
                <>
                  <motion.div 
                    className="absolute rounded-full border-2 border-indigo-500/30 bg-indigo-500/5 pointer-events-none z-[55]"
                    style={{ 
                      left: `${userXY.x}%`, 
                      top: `${userXY.y}%`,
                      width: `${userLocation.accuracy_meters * 2}px`,
                      height: `${userLocation.accuracy_meters * 2}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    animate={{ opacity: [0.2, 0.4, 0.2] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                  />
                  <motion.div 
                    className="absolute w-5 h-5 bg-indigo-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(99,102,241,0.9)] z-[60]"
                    style={{ left: `${userXY.x}%`, top: `${userXY.y}%` }}
                    animate={{ rotate: userLocation.heading || 0 }}
                  >
                    <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-40" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-1 h-2 bg-white rounded-full" />
                  </motion.div>
                </>
              )}

              {isNavigating && selectedPin && !optimalRoute && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <motion.path
                    d={`M 500,200 L ${selectedPin.x * 10},${selectedPin.y * 4}`}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </svg>
              )}
            </div>
          </div>
        </motion.div>

        {/* Neural Scanning HUD Overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px] pointer-events-none"
            >
               <div className="text-center p-8 glass-panel tactical-border rounded-[2rem] bg-indigo-500/5">
                  <BrainCircuit className="w-12 h-12 text-indigo-400 animate-pulse mx-auto mb-4" />
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Scanning_Mesh...</h3>
                  <div className="w-48 h-1 bg-slate-900 mx-auto mt-4 rounded-full overflow-hidden">
                     <motion.div 
                       animate={{ x: ['-100%', '100%'] }}
                       transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                       className="w-full h-full bg-indigo-500" 
                     />
                  </div>
                  <div className="mt-4 flex flex-col gap-1">
                     <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">Optimizing_Exit_Strategy</span>
                     <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Avoiding_Congestion_Nodes</span>
                  </div>
               </div>
               
               {/* Corner accents */}
               <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-indigo-500/50" />
               <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-indigo-500/50" />
               <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-indigo-500/50" />
               <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-indigo-500/50" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Scan Line */}
        <motion.div 
           animate={{ top: ['-10%', '110%'] }}
           transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
           className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)] z-10 pointer-events-none"
        />

        {/* Info Sidebar Overlay */}
        <AnimatePresence>
          {selectedPin && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="absolute top-4 right-4 bottom-4 w-80 bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-[2rem] p-6 flex flex-col justify-between shadow-2xl z-50 overflow-hidden"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">{selectedPin.status}</span>
                  </div>
                  <button onClick={() => setSelectedPin(null)} className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-full text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedPin.label}</h3>
                  <p className="text-xs text-slate-400 mt-2">{selectedPin.desc}</p>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between text-[8px] font-mono uppercase text-slate-500 font-bold">
                      <span>Connectivity</span>
                      <span className="text-emerald-500">{selectedPin.connectivity}</span>
                   </div>
                   <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: selectedPin.connectivity }} />
                   </div>
                </div>

                {(profile?.role === 'admin' || profile?.role === 'staff') && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleSecureBlockNode(selectedPin.id)}
                      className={cn(
                        "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all border",
                        blockedNodes.has(selectedPin.id) 
                          ? "bg-red-500/10 border-red-500/40 text-red-500" 
                          : "bg-red-600 text-white hover:bg-red-500"
                      )}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      {blockedNodes.has(selectedPin.id) ? "NODE_COMPROMISED" : "BLOCK_NODE"}
                    </button>
                    {blockedNodes.has(selectedPin.id) && (
                      <p className="text-[8px] font-mono text-red-400 uppercase text-center animate-pulse">Critical: Route exclusion active</p>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  setIsNavigating(true);
                  setSelectedPin(null);
                }}
                className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl flex items-center justify-center gap-3"
              >
                <Navigation className="w-4 h-4" />
                PATHFIND
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!minimal && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => startAR('evacuation')} className="bg-emerald-500/10 p-4 border border-emerald-500/20 rounded-2xl flex items-center justify-between group">
             <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">AR Evac Trace</span>
             <ChevronRight className="w-3 h-3 text-emerald-700" />
          </button>
          <button onClick={() => startAR('responder')} className="bg-indigo-500/10 p-4 border border-indigo-500/20 rounded-2xl flex items-center justify-between group">
             <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">AR Responder HUD</span>
             <ChevronRight className="w-3 h-3 text-indigo-700" />
          </button>
          <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-2xl flex items-center justify-between">
             <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Hazards: {hazardsCount}</span>
             <Activity className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      )}

      <AnimatePresence>
        {nearestSafeZone && !selectedPin && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-6 left-6 right-6 z-[80]"
          >
             <div className={cn(
               "glass-panel tactical-border rounded-3xl p-6 shadow-2xl flex items-center justify-between transition-all",
               isInsideSafeZone ? "bg-emerald-500/10 border-emerald-500/40" : "bg-slate-900/90 border-slate-800"
             )}>
                <div className="flex items-center gap-4">
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center",
                     isInsideSafeZone ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"
                   )}>
                      {isInsideSafeZone ? <ShieldCheck className="w-6 h-6" /> : <Navigation className="w-6 h-6" />}
                   </div>
                   <div>
                      <h4 className="text-white font-black text-sm uppercase tracking-tight">
                        {isInsideSafeZone ? "Node Status: SAFE_ZONE" : `Nearest Node: ${nearestSafeZone.name}`}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
                        {isInsideSafeZone ? "Protocols Standby • Stay in zone" : `Distance: ${Math.round(distanceToNearestMeters || 0)}m • Guide active`}
                      </p>
                   </div>
                </div>

                {!isInsideSafeZone && (
                  <div className="flex flex-col items-end gap-2">
                     <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-mono text-white font-bold">{Math.round(distanceToNearestMeters || 0)}M</span>
                     </div>
                     <button 
                       onClick={() => {
                         TacticalAudio.playConfirm();
                         scanForHazards();
                       }}
                       className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
                     >
                        Guide
                        <ChevronRight className="w-3 h-3" />
                     </button>
                  </div>
                )}

                {isInsideSafeZone && (
                   <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                      <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Clearance Active</span>
                   </div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSyncingAR && (
          <div className="fixed inset-0 z-[200] bg-indigo-950/40 backdrop-blur-3xl flex items-center justify-center">
             <div className="text-center space-y-4">
                <Activity className="w-12 h-12 text-indigo-400 animate-pulse mx-auto" />
                <h2 className="text-xl font-black text-white uppercase italic tracking-widest">Neural_Syncing...</h2>
             </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {arMode && <AROverlay mode={arMode} onClose={() => setArMode(null)} />}
      </AnimatePresence>

      <MFADialog 
        isOpen={mfaOpen}
        onClose={() => setMfaOpen(false)}
        actionName="Block Node Axis"
        onVerify={() => {
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
      />
    </div>
  );
}
