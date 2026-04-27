import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Navigation, AlertTriangle, ShieldCheck, Zap, Users, Flame, Target, Crosshair, MapPin, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotify } from '../contexts/NotificationContext';
import { useTactical } from '../contexts/TacticalContext';

interface Hazard {
  id: string;
  type: 'fire' | 'crowd' | 'blockage' | 'medical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  x: number; // Percent from left
  y: number; // Percent from top
  z: number; // Simulated depth (0-100, where 0 is closest)
  description: string;
  distance: string;
}

interface AROverlayProps {
  onClose: () => void;
  mode: 'evacuation' | 'responder';
}

export default function AROverlay({ onClose, mode }: AROverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { notify, isOnline } = useNotify();
  const { optimalRoute, activeIncidentId, incidentData, blockedNodes, isScanning, scanForHazards } = useTactical();
  const [isReady, setIsReady] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Device Heading Logic
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    const handleOrientation = (e: any) => {
      if (e.webkitCompassHeading) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha !== null) {
        setHeading(360 - e.alpha);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Calibration Logic
  useEffect(() => {
    if (isReady && !isCalibrated) {
      const interval = setInterval(() => {
        setCalibrationProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsCalibrated(true);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isReady, isCalibrated]);

  // Direction logic: Calculate rotation for path markers based on heading and waypoints
  const waypoints = useMemo(() => {
    if (!optimalRoute || optimalRoute.length < 2) return [];
    return optimalRoute;
  }, [optimalRoute]);

  // Check if any node in the route is blocked
  const isRouteCompromised = useMemo(() => {
    if (!optimalRoute) return false;
    // In our MESH_NODES, id matches labels or we just check the path nodes
    // Simplified: if any node in current optimal path is actually blocked
    return [...blockedNodes].some(id => optimalRoute.some((step: any) => step.id === id));
  }, [optimalRoute, blockedNodes]);

  // Simulated real-time hazards with simulated depth (z)
  const [hazards] = useState<Hazard[]>([
    { id: 'h1', type: 'crowd', severity: 'high', x: 75, y: 35, z: 12, description: 'Congestion: Main Hall', distance: '12m' },
    { id: 'h2', type: 'fire', severity: 'critical', x: 25, y: 50, z: 45, description: 'Thermal Spike: Sector G', distance: '45m' },
    { id: 'h3', type: 'blockage', severity: 'low', x: 50, y: 25, z: 8, description: 'Maintenance: West Exit', distance: '8m' },
    { id: 'h4', type: 'medical', severity: 'medium', x: 85, y: 45, z: 25, description: 'First Aid Station', distance: '25m' },
  ]);

  // Tactical Overlays (Specific to Responder Mode)
  const tacticalNodes = useMemo(() => [
    { id: 't1', x: 30, y: 40, label: 'LKP: Suspect Last Position', type: 'target' },
    { id: 't2', x: 65, y: 60, label: 'OBJ: Breached Access Point', type: 'objective' },
  ], []);

  // Direction logic: Calculate horizontal offset (x-shift) for path markers
  // This simulates where the exit is relative to the "Forward" camera view
  const pathOffset = useMemo(() => {
    if (!optimalRoute || optimalRoute.length < 2) return 0;
    // Simple heuristic: If first waypoint is to the right of 50%, shift markers right
    const nextPoint = optimalRoute[1];
    return (nextPoint.x - 50) * 1.5; 
  }, [optimalRoute]);

  // Lightweight on-device "AI" Classifier for offline fallback
  const processFrameLocally = (frame: ImageData) => {
    // This is a placeholder for actual TensorFlow.js or similar on-device inference
    // In this app, we simulate detection triggers
    return Math.random() > 0.95 ? 'Anomaly detected' : null;
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsOfflineMode(!isOnline);
  }, [isOnline]);

  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support camera access or is not in a secure context.");
      }

      // Cleanup existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Try environment camera first
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false 
        });
      } catch (e) {
        console.warn("Ideal camera config failed, trying fallback...", e);
        // Fallback to ANY camera
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false 
        });
      }
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsReady(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      const message = err.name === 'NotAllowedError' 
        ? "Access Denied: Please enable camera permissions in your browser settings to use AR navigation. Visit site settings to allow access."
        : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
        ? "Camera Not Found: Could not detect a camera on this device. Ensure hardware is active."
        : "Optics Failure: Dynamic scan requires camera authorization. Check if another app is using it.";
      
      setError(message);
      notify(message, "error");
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulated tracking and lighting metrics
  const [trackingStability, setTrackingStability] = useState(98.4);
  const [ambientLight, setAmbientLight] = useState(0.85);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrackingStability(s => Math.min(100, Math.max(95, s + (Math.random() - 0.5))));
      setAmbientLight(l => Math.min(1.2, Math.max(0.6, l + (Math.random() - 0.5) * 0.1)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Lightweight filter simulation based on mode and lighting
  const filterStyle = useMemo(() => {
    const brightness = (mode === 'evacuation' ? 0.5 : 0.75) * ambientLight;
    const contrast = 1.25 / ambientLight;
    return `grayscale(${mode === 'evacuation' ? 1 : 0}) brightness(${brightness}) contrast(${contrast}) sepia(${mode === 'responder' ? 0.3 : 0})`;
  }, [mode, ambientLight]);

  // Simulated movement/rotation for FOV effects
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    const handleMotion = (e: DeviceOrientationEvent) => {
      if (e.gamma) setRotation(e.gamma);
    };
    window.addEventListener('deviceorientation', handleMotion);
    return () => window.removeEventListener('deviceorientation', handleMotion);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 border-red-500/50 bg-red-900/40 shadow-[0_0_30px_rgba(239,68,68,0.4)]';
      case 'high': return 'text-orange-500 border-orange-500/50 bg-orange-900/30 shadow-[0_0_20px_rgba(249,115,22,0.3)]';
      case 'medium': return 'text-amber-500 border-amber-500/50 bg-amber-900/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      default: return 'text-indigo-400 border-indigo-500/50 bg-indigo-900/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]';
    }
  };

  const getHazardIcon = (type: string) => {
    switch (type) {
      case 'fire': return Flame;
      case 'crowd': return Users;
      case 'blockage': return Zap;
      default: return AlertTriangle;
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      {!error && (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
          style={{ filter: filterStyle }}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-zinc-950 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
            <Camera className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic mb-2">Optics Error</h2>
          <p className="text-zinc-400 text-sm max-w-xs mb-8">{error}</p>
          <div className="flex gap-4 w-full max-w-xs">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-zinc-800 text-zinc-300 font-black uppercase rounded-2xl border border-zinc-700 hover:bg-zinc-700 transition-all"
            >
              Abort
            </button>
            <button 
              onClick={startCamera}
              className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Dynamic Optical Distortion Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      
      {/* AR HUD Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Navigation Grid Overlay */}
        <div className="absolute inset-0 border-[20px] border-white/5 mix-blend-overlay" />
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-indigo-500/20 -translate-y-1/2" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-indigo-500/20 -translate-x-1/2" />
        
        {/* Scanning Line */}
        <motion.div 
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-[2px] bg-indigo-500/40 shadow-[0_0_20px_#6366f1] z-10"
        />

        <AnimatePresence>
          {isReady && isCalibrated && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <div className="relative w-full h-full perspective-1000">
                {/* 1. Navigation Flow Markers (Refined Directionality) */}
                <div className="absolute inset-0 overflow-hidden flex justify-center pointer-events-none">
                  {waypoints.length > 0 && [...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.2, y: 200, z: -200, x: 0 }}
                      animate={{ 
                        opacity: [0, 0.6, 0.8, 0],
                        scale: [0.2, 1, 2],
                        y: [400, -100],
                        z: [-200, 150],
                        x: [pathOffset * 1, pathOffset * 3] 
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        delay: i * 0.5,
                        ease: "linear"
                      }}
                      className="absolute bottom-0 flex flex-col items-center"
                    >
                      <div className="relative">
                        <Navigation className={cn(
                          "w-24 h-24 transform drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                          pathOffset > 5 ? "-rotate-[30deg]" : pathOffset < -5 ? "-rotate-[60deg]" : "-rotate-45",
                          isRouteCompromised ? "text-red-500" : (mode === 'evacuation' ? "text-emerald-500/90" : "text-indigo-500/80")
                        )} />
                        {isRouteCompromised && (
                          <motion.div 
                            animate={{ opacity: [0.2, 0.6, 0.2] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                             <AlertTriangle className="w-12 h-12 text-white opacity-50" />
                          </motion.div>
                        )}
                      </div>
                      
                      {/* Trail Trace (Evacuation only) */}
                      {mode === 'evacuation' && (
                        <div className={cn(
                          "w-1 h-32 bg-gradient-to-t from-transparent via-current to-transparent blur-[2px] opacity-40 mt-4",
                          isRouteCompromised ? "text-red-500" : "text-emerald-500"
                        )} />
                      )}

                      <div className={cn(
                        "mt-4 text-[12px] font-black uppercase tracking-[0.6em] px-4 py-1.5 rounded-full bg-black/70 backdrop-blur-md border",
                        isRouteCompromised ? "text-red-400 border-red-500/40" : (mode === 'evacuation' ? "text-emerald-400 border-emerald-500/20" : "text-indigo-400 border-indigo-500/20")
                      )}>
                        {isRouteCompromised ? 'ROUTE_BLOCKED' : (mode === 'evacuation' ? 'FOLLOW_TRACE' : 'SECURE_PATH')}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* 1.1 Responder Tactical Layer (Specific to Responders) */}
                {mode === 'responder' && (
                  <div className="absolute inset-0 pointer-events-none">
                    {tacticalNodes.map(node => (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute flex flex-col items-center"
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      >
                        <div className="relative">
                          <div className="absolute -inset-4 border border-red-500/40 rounded-full animate-ping" />
                          {node.type === 'target' ? (
                            <Crosshair className="w-10 h-10 text-red-500" />
                          ) : (
                            <Target className="w-10 h-10 text-indigo-500" />
                          )}
                        </div>
                        <div className="mt-4 px-3 py-1 bg-black/80 border border-white/10 rounded-lg backdrop-blur-sm shadow-2xl">
                          <span className="text-[9px] font-black text-white uppercase tracking-tighter whitespace-nowrap">{node.label}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* 1.2 Responder Target Lock (Specific to Responders) */}
                {mode === 'responder' && activeIncidentId && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 2 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
                   >
                      <div className="relative">
                         <div className="absolute -inset-8 border border-indigo-500/20 rounded-full animate-ping" />
                         <div className="absolute -inset-4 border border-indigo-500/40 rounded-full animate-spin [animation-duration:10s]" />
                         <Crosshair className="w-16 h-16 text-indigo-500 animate-pulse" />
                      </div>
                      <div className="text-center p-4 glass-panel tactical-border bg-slate-950/60 rounded-3xl">
                         <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-red-500" />
                            <span className="text-xs font-black text-white uppercase tracking-tighter">Target_Acquired: {incidentData?.type || 'INCIDENT'}</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-indigo-400">ETA: 45s</span>
                            <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden w-24">
                               <motion.div 
                                 animate={{ width: ['0%', '100%'] }} 
                                 transition={{ duration: 2, repeat: Infinity }}
                                 className="h-full bg-indigo-500" 
                               />
                            </div>
                         </div>
                      </div>
                   </motion.div>
                )}

                {/* 2. Real-time Hazard Markers with Distance and FOV Scaling */}
                {hazards.filter(h => mode === 'responder' || h.severity !== 'low').map((hazard) => {
                  const Icon = getHazardIcon(hazard.type);
                  
                  // Calculate center-focus FOV multiplier
                  // Markers near the horizontal center (50%) are "in focus"
                  const centerOffset = Math.abs(hazard.x - 50);
                  const fovMultiplier = Math.max(0.6, 1 - (centerOffset / 60));
                  
                  // Dynamic scaling logic based on simulated depth and FOV focus
                  const scale = Math.max(0.3, (1.2 - (hazard.z / 60)) * fovMultiplier);
                  const opacity = Math.max(0.2, (1 - (hazard.z / 100)) * fovMultiplier);
                  const isVisible = hazard.z < 85; 

                  if (!isVisible) return null;

                  const isHighFocus = centerOffset < 15 && hazard.z < 30;

                  return (
                    <motion.div
                      key={hazard.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale, 
                        opacity,
                        x: rotation * 0.5, // Slight parallax
                        y: [0, -10, 0] 
                      }}
                      transition={{
                        scale: { duration: 0.5 },
                        y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="absolute group pointer-events-auto"
                      style={{ 
                        left: `${hazard.x}%`, 
                        top: `${hazard.y}%`, 
                        transform: 'translate(-50%, -50%)',
                        zIndex: 100 - Math.round(hazard.z)
                      }}
                    >
                      {/* Perspective Ring */}
                      <div className={cn(
                        "absolute -inset-16 rounded-full blur-3xl transition-opacity duration-700",
                        hazard.severity === 'critical' ? 'bg-red-500' : hazard.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500',
                        isHighFocus ? "opacity-30" : "opacity-10"
                      )} />
                      
                      <div className={cn(
                        "relative transition-all duration-500",
                        isHighFocus ? "p-4 border-2 scale-110" : "p-2 border scale-90",
                        "backdrop-blur-lg rounded-[2.5rem] flex flex-col items-center gap-2 group-hover:scale-105 active:scale-95 shadow-2xl",
                        getSeverityColor(hazard.severity),
                        "border-white/10"
                      )}>
                        {/* Dynamic Sizing Container */}
                        <div className="flex items-center gap-3 px-2">
                           <Icon className={cn(
                             "transition-all duration-700",
                             isHighFocus ? "w-10 h-10" : "w-6 h-6",
                             hazard.severity === 'critical' && "animate-pulse"
                           )} />
                           
                           {/* Details revealed only on focus or close proximity */}
                           <AnimatePresence>
                             {(isHighFocus || hazard.z < 15) && (
                               <motion.div 
                                 initial={{ width: 0, opacity: 0, overflow: 'hidden' }}
                                 animate={{ width: 'auto', opacity: 1 }}
                                 exit={{ width: 0, opacity: 0 }}
                                 className="flex flex-col whitespace-nowrap"
                               >
                                 <span className="text-[12px] font-black uppercase tracking-tight leading-none mb-1 text-white">{hazard.description}</span>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-white/70 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{hazard.distance}</span>
                                    <div className={cn(
                                      "w-2 h-2 rounded-full",
                                      hazard.severity === 'critical' ? 'bg-red-500 animate-ping' : 'bg-white/40'
                                    )} />
                                 </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </div>
                      </div>

                      {/* Geometric Floor Projection */}
                      <div className={cn(
                        "absolute top-full left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-b from-white/40 to-transparent transition-all duration-1000",
                        isHighFocus ? "h-40 opacity-40" : "h-20 opacity-10"
                      )} />
                    </motion.div>
                  );
                })}

                {/* 3. Static Cached Map Nodes (Offline Support) */}
                <motion.div 
                   animate={{ scale: [1, 1.05, 1] }}
                   transition={{ duration: 3, repeat: Infinity }}
                   className="absolute bottom-1/4 right-1/4 p-4 border border-emerald-500/50 bg-emerald-500/10 backdrop-blur-md rounded-2xl flex items-center gap-3"
                >
                   <ShieldCheck className="w-8 h-8 text-emerald-400" />
                   <div>
                     <div className="text-[8px] font-black uppercase tracking-widest text-emerald-100">SAFE_ZONE_ALPHA</div>
                     <div className="text-[6px] font-mono text-emerald-400 mt-1 uppercase">Cached Venue Local Data</div>
                   </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Calibration Overlay */}
      <AnimatePresence>
        {isReady && !isCalibrated && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
          >
             <div className="w-64 h-64 border-2 border-indigo-500/30 rounded-full flex items-center justify-center relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-t-2 border-indigo-500"
                />
                <div className="text-center p-8 space-y-4">
                   <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto">
                      <Activity className="w-8 h-8 animate-pulse" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Calibrating...</h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed mt-2">
                        Point camera at ground to sync spatial mesh
                      </p>
                   </div>
                   <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${calibrationProgress}%` }} 
                      />
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Metadata Overlay */}
      <div className="relative z-20 p-6 flex flex-col justify-between h-full pointer-events-none">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-4 pointer-events-auto">
             <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-center relative overflow-hidden group">
                <div className="scanline" />
                <Camera className="w-7 h-7 text-indigo-400" />
             </div>
             <div className="space-y-1">
                <h2 className="text-lg font-black uppercase tracking-tight text-white leading-none italic">
                  QuantumLink_<span className="text-indigo-500">Lens_v3</span>
                </h2>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                    isOfflineMode ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  )}>
                    {isOfflineMode ? 'EDGE_AI_OFFLINE' : 'MESH_TUNNEL'}
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[7px] font-mono text-indigo-400 font-bold uppercase">
                    <Zap className={cn("w-2 h-2", trackingStability < 97 ? "text-amber-400 animate-pulse" : "text-indigo-400")} />
                    Stability: {trackingStability.toFixed(1)}%
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 font-bold uppercase italic tracking-tighter">FPS: {(60 + (Math.random() - 0.5)).toFixed(1)}</span>
                </div>
             </div>
          </div>

          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center hover:bg-red-600/20 transition-all pointer-events-auto group"
          >
            <X className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
          </button>
        </header>

        <footer className="flex items-end justify-between">
           <div className="space-y-5 pointer-events-auto">
              <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                 <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic">Environmental_Synthesis: NOMIINAL</span>
              </div>
              
              <div className="glass-panel border-slate-800 p-6 rounded-[2rem] tactical-border bg-slate-950/40 backdrop-blur-xl w-72">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{mode === 'responder' ? 'TACTICAL_HUD' : 'EVAC_GUIDE'}.os</span>
                    <div className={cn(
                      "px-2 py-0.5 text-[7px] font-black uppercase tracking-widest rounded",
                      mode === 'responder' ? "bg-indigo-500 text-white" : "bg-emerald-500 text-white"
                    )}>{mode === 'responder' ? 'L4_AUTH' : 'SAFE'}</div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{mode === 'responder' ? 'Target_Dist' : 'Exit_Dist'}</div>
                        <div className="text-lg font-black font-mono text-white tracking-tighter">{mode === 'responder' ? '42.8' : '32.5'}<span className="text-[10px] ml-1">M</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Bearing</div>
                        <div className="text-lg font-black font-mono text-white tracking-tighter">042<span className="text-[10px] ml-1">° NE</span></div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-800/50">
                       <div className="text-[8px] font-mono text-slate-400 uppercase italic">
                         {mode === 'responder' ? 'MeshSync_Active: Sector_G_Grid' : 'Directive: Maintain_Calm_Head_to_Alpha'}
                       </div>
                       {mode === 'responder' && (
                         <div className="mt-2 flex items-center gap-2">
                           <Activity className="w-3 h-3 text-red-500 animate-pulse" />
                           <span className="text-[7px] font-black text-red-500 uppercase">Self_Stress_Index: 12%</span>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="relative group cursor-pointer pointer-events-auto">
             <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-[40px] animate-pulse" />
             <div className="w-40 h-40 border-2 border-indigo-500/20 rounded-full flex items-center justify-center relative overflow-hidden backdrop-blur-sm bg-slate-950/20">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px:20px] opacity-20" />
                <div className="w-32 h-32 border border-indigo-500/40 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                   <div className="w-1 h-1 bg-white rounded-full absolute top-4 shadow-[0_0_8px_#fff]" />
                   <Navigation className={cn(
                     "w-12 h-12 text-indigo-500 animate-[bounce_2s_infinite]",
                     mode === 'evacuation' ? "text-emerald-500" : "text-indigo-500"
                   )} />
                </div>
                
                {/* HUD Compass Ticks */}
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-1 h-2 bg-indigo-500/30" 
                    style={{ transform: `rotate(${i * 90}deg) translateY(-60px)` }} 
                  />
                ))}
             </div>
           </div>
        </footer>
      </div>
    </div>
  );
}
