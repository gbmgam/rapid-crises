import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { 
  AlertCircle, 
  MapPin, 
  Wifi, 
  Shield, 
  Mic, 
  Zap, 
  Activity,
  Navigation,
  Power,
  RotateCcw,
  Smartphone,
  EyeOff,
  Settings,
  ChevronRight,
  Bluetooth,
  Battery,
  AlertTriangle,
  BrainCircuit
} from 'lucide-react';
import { useTactical } from '../contexts/TacticalContext';
import { useNotify } from '../contexts/NotificationContext';
import { TacticalAudio } from '../lib/audio';
import CrisisChat from './CrisisChat';
import SafetyTimer from './SafetyTimer';
import VenueMap from './VenueMap';
import { cn } from '../lib/utils';

export default function GuestSOS() {
  const { 
    mode, 
    activeIncidentId, 
    incidentData, 
    triggerEmergency, 
    resolveIncident, 
    prediction, 
    isSafe,
    sensorStats,
    offlineQueueCount,
    privacyConsent,
    setPrivacyConsent,
    safetyTimer,
    setSafetyTimer,
    anonId
  } = useTactical();
  const { notify } = useNotify();
  const [triggerState, setTriggerState] = useState<'idle' | 'holding' | 'triggered' | 'selecting' | 'countdown'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [description, setDescription] = useState('');
  const controls = useAnimation();
  const countdownTimerRef = useRef<any>(null);

  const startCountdown = () => {
    setTriggerState('countdown');
    setCountdown(3);
    TacticalAudio.playBlip(1200, 0.1);
    
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          commitEmergency('evac');
          return 0;
        }
        TacticalAudio.playBlip(1200 - (3 - prev + 1) * 100, 0.1);
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    clearInterval(countdownTimerRef.current);
    setTriggerState('idle');
    TacticalAudio.playError();
    notify("Emergency trigger aborted.", "info");
  };

  const handleHoldStart = () => {
    if (activeIncidentId) return;
    setTriggerState('holding');
    controls.start({
      scale: 1.1,
      transition: { duration: 1.5 }
    });
    const timer = setTimeout(() => {
      setTriggerState('selecting');
      TacticalAudio.playBlip(900, 0.1);
    }, 1500);
    (window as any).holdTimer = timer;
  };

  const handleHoldEnd = () => {
    if (triggerState === 'holding') {
      setTriggerState('idle');
      controls.stop();
      controls.set({ scale: 1 });
      clearTimeout((window as any).holdTimer);
    }
  };

  const commitEmergency = async (type: 'evac' | 'silent' | 'medical') => {
    setTriggerState('triggered');
    await triggerEmergency(
      type === 'evac' ? 'Evacuation Required' : type === 'silent' ? 'Silent Distress' : 'Medical Assistance', 
      description || 'Manual Trigger',
      type === 'silent'
    );
  };

  if (triggerState === 'countdown') {
    return (
      <div className="fixed inset-0 z-[150] bg-red-600 flex flex-col items-center justify-center p-8 text-white">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-8"
        >
          <div className="relative w-48 h-48 flex items-center justify-center">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute inset-0 bg-white rounded-full"
            />
            <span className="relative text-8xl font-black">{countdown}</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter italic">Triggering SOS</h2>
            <p className="text-white/70 text-sm font-medium uppercase tracking-widest">Uplinking to localized emergency mesh...</p>
          </div>
          <button 
            onClick={cancelCountdown}
            className="px-12 py-6 bg-white text-red-600 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl active:scale-95 transition-all"
          >
            Abort Protocol
          </button>
        </motion.div>
      </div>
    );
  }

  if (!privacyConsent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
        <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center text-cyan-400 border border-cyan-500/20">
          <Shield className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase italic">Initialize Guardian</h2>
          <p className="text-sm text-zinc-400">QuantumLink requires mesh authorization to pulse sensors and establish a safety uplink.</p>
        </div>
        <div className="grid gap-3 w-full">
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700 text-left">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <div className="text-[10px] text-zinc-300 font-medium">Real-time Location Pulse (GPS)</div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700 text-left">
            <Mic className="w-4 h-4 text-cyan-400" />
            <div className="text-[10px] text-zinc-300 font-medium">Acoustic Signature Analysis (Mic)</div>
          </div>
        </div>
        <button 
          onClick={() => setPrivacyConsent(true)}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase rounded-2xl transition-all shadow-lg shadow-cyan-500/20"
        >
          Authorize Safety Link
        </button>
      </div>
    );
  }

  if (mode === 'silent') {
    return <SilentModeUI activeIncidentId={activeIncidentId} />;
  }

  if (mode === 'escape') {
    return <EscapeModeUI activeIncidentId={activeIncidentId!} incidentData={incidentData} resolve={resolveIncident} />;
  }

  if (activeIncidentId) {
    return (
      <div className="h-full flex flex-col gap-6 animate-in zoom-in-95 duration-500">
        <div className="glass-panel p-6 rounded-[2.5rem] tactical-border bg-red-500/5 border-red-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 text-white">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Active Incident</h2>
                <div className="flex items-center gap-2">
                   <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-black text-red-400 uppercase tracking-widest">
                     {incidentData?.type || 'Panic'}
                   </div>
                   <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                     {incidentData?.status || 'Reported'}
                   </div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => resolveIncident(activeIncidentId)}
              className="px-4 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
            >
              Resolve
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <CrisisChat emergencyId={activeIncidentId} role="guest" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-500">
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">QuantumLink v2.5 Running</span>
          </div>
          {offlineQueueCount > 0 && (
            <div className="px-2 py-0.5 bg-amber-500 text-black text-[8px] font-black rounded uppercase">
              Offline Cache: {offlineQueueCount}
            </div>
          )}
        </div>
        <h1 className="text-4xl font-black text-white uppercase tracking-tight leading-none">Guardian<span className="text-indigo-500">AI</span></h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
           <div className="p-3 glass-panel rounded-xl border border-white/5 bg-zinc-900/50">
              <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Ambient_Noise</span>
              <div className="text-lg font-black text-white">{sensorStats.db} <span className="text-[10px] text-slate-400">dB</span></div>
           </div>
           <div className="p-3 glass-panel rounded-xl border border-white/5 bg-zinc-900/50">
              <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Crowd_Density</span>
              <div className="text-lg font-black text-white">{sensorStats.crowd} <span className="text-[10px] text-slate-400">Nodes</span></div>
           </div>
           <div className="p-3 glass-panel rounded-xl border border-white/5 bg-zinc-900/50">
              <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Risk_Level</span>
              <div className={cn("text-lg font-black uppercase", prediction.riskLevel === 'high' ? 'text-red-500' : 'text-emerald-500')}>
                {prediction.riskLevel}
              </div>
           </div>
           <div className="p-3 glass-panel rounded-xl border border-white/5 bg-zinc-900/50">
              <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Network</span>
              <div className="text-lg font-black text-white uppercase flex items-center gap-1.5">
                <Wifi className={cn("w-3 h-3", navigator.onLine ? "text-emerald-500" : "text-red-500")} />
                {navigator.onLine ? 'Online' : 'Mesh'}
              </div>
           </div>
        </div>
      </header>

      <div className="relative flex items-center justify-center py-6">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
        
        <AnimatePresence>
          {triggerState === 'selecting' ? (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="absolute z-50 flex flex-col items-center gap-6 p-8 glass-panel rounded-[3.5rem] border border-red-500/30 bg-slate-950/90 backdrop-blur-2xl shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            >
               <h3 className="text-xl font-black text-white uppercase tracking-tighter">Choose Survival Protocol</h3>
               <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => commitEmergency('evac')}
                    className="p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center gap-2 group hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-600/10"
                  >
                     <Navigation className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                     <div className="text-center">
                        <div className="text-[10px] font-black uppercase">Evacuate</div>
                     </div>
                  </button>
                  <button 
                    onClick={() => commitEmergency('medical')}
                    className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex flex-col items-center gap-2 group hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-blue-600/10"
                  >
                     <Activity className="w-6 h-6 text-blue-500 group-hover:text-white" />
                     <div className="text-center">
                        <div className="text-[10px] font-black uppercase">Medical</div>
                     </div>
                  </button>
                  <button 
                    onClick={() => commitEmergency('silent')}
                    className="p-4 bg-red-600/10 border border-red-500/20 rounded-2xl flex flex-col items-center gap-2 group hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-600/10"
                  >
                     <EyeOff className="w-6 h-6 text-red-500 group-hover:text-white" />
                     <div className="text-center">
                        <div className="text-[10px] font-black uppercase">Silent</div>
                     </div>
                  </button>
               </div>
               <button 
                 onClick={() => setTriggerState('idle')}
                 className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
               >
                 Cancel Protocol
               </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          animate={controls}
          onClick={startCountdown}
          onContextMenu={(e) => {
            e.preventDefault();
            setTriggerState('selecting');
          }}
          className={cn(
            "relative w-48 h-48 rounded-[3.5rem] border-4 flex flex-col items-center justify-center transition-all duration-300 shadow-2xl",
            "bg-slate-900 border-red-500 shadow-red-600/20 group hover:bg-red-600 hover:border-red-400"
          )}
        >
          <div className="absolute inset-0 bg-red-600 opacity-0 group-hover:opacity-10 rounded-[3.5rem] transition-opacity" />
          <Power className={cn("w-12 h-12 mb-2 text-red-500 group-hover:text-white")} />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white group-hover:scale-110 transition-transform">Emergency SOS</span>
          <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-widest opacity-50 group-hover:text-white/60 text-center px-4">Tap to trigger 3s uplink</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => {
            notify("Power button simulation: Triple tap detected.", "info");
            triggerEmergency('harassment', 'Stealth mode trigger', true);
          }}
          className="p-6 glass-panel rounded-[2.5rem] tactical-border flex flex-col gap-4 group hover:bg-slate-900/50 transition-all"
        >
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-amber-500 transition-colors">
            <Power className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Stealth Trigger</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">Simulate Shake / Power Tap</p>
          </div>
        </button>

        <button 
          onClick={() => setSafetyTimer(300)}
          className={cn(
            "p-6 glass-panel rounded-[2.5rem] tactical-border flex flex-col gap-4 transition-all",
            safetyTimer !== null ? "bg-indigo-600/20 border-indigo-500/40" : "bg-zinc-900/20 hover:bg-zinc-900/40"
          )}
        >
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-slate-500">
            {safetyTimer !== null ? <span className="text-indigo-400 font-mono font-bold animate-pulse">{safetyTimer}s</span> : <Activity className="w-5 h-5" />}
          </div>
          <div className="text-left">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Dead-Man Switch</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-1 leading-tight">Timer-based Auto-SOS</p>
          </div>
        </button>
      </div>

      <div className="p-6 glass-panel rounded-[3rem] tactical-border bg-slate-900/10 space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
          <Zap className="w-3 h-3 text-indigo-500" />
          Rapid Interaction Presets
        </h3>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional tactical metadata..."
          className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:border-indigo-500/30 transition-all min-h-[80px] resize-none"
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {['Medical Support', 'Active Fire', 'Security Leak'].map(item => (
            <button 
              key={item}
              onClick={() => triggerEmergency(item.toLowerCase().split(' ')[0], description)}
              className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 glass-panel rounded-[3rem] tactical-border bg-slate-900/10 space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
          <Mic className="w-3 h-3" />
          Voice Protocol Simulation
        </h3>
        <div className="grid grid-cols-2 gap-3">
           <button 
             onClick={() => {
               notify("Keyword 'Guardian Test' detected.", "info");
               TacticalAudio.playConfirm();
             }}
             className="p-3 bg-slate-950 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all active:scale-95"
           >
             "Guardian Test"
           </button>
           <button 
             onClick={() => {
               notify("Keyword 'Help' detected [Confidence: 0.92]", "error");
               triggerEmergency('voice_keyword', 'Emergency voice activation');
             }}
             className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 transition-all active:scale-95"
           >
             "Help"
           </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
        <p className="text-[9px] text-zinc-500 leading-relaxed italic">
          Privacy: Sensors are only pulsed locally. High accuracy GPS is engaged during active SOS sessions. Background data is auto-purged every 24h.
        </p>
      </div>
    </div>
  );
}

function SilentModeUI({ activeIncidentId }: { activeIncidentId: string | null }) {
  return (
    <div className="h-full space-y-6 animate-in fade-in duration-1000 bg-slate-950">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
         <div className="flex items-center gap-4">
           <Settings className="w-5 h-5 text-slate-400" />
           <span className="text-sm font-medium text-slate-200">System Settings</span>
         </div>
         <Battery className="w-5 h-5 text-emerald-400" />
      </div>
      
      <div className="px-4 space-y-2">
         {['WiFi & Network', 'Bluetooth Devices', 'Display & Appearance', 'Privacy & Security', 'Location Services'].map((item) => (
           <div key={item} className="flex items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-white/5 group active:bg-slate-800/60">
              <span className="text-sm text-slate-400 group-active:text-slate-200">{item}</span>
              <ChevronRight className="w-4 h-4 text-slate-700" />
           </div>
         ))}
      </div>

      <div className="px-6 relative z-10 pt-4 flex-1 overflow-hidden h-[400px]">
         <div className="h-[300px]">
           <CrisisChat emergencyId={activeIncidentId!} role="guest" />
         </div>
      </div>

      <div className="text-center pb-8">
         <p className="text-[9px] text-slate-800 font-mono uppercase tracking-[0.5em]">Tactical Mesh v4.4 // Stealth Mode Enabled</p>
      </div>
    </div>
  );
}

function EscapeModeUI({ activeIncidentId, incidentData, resolve }: { activeIncidentId: string, incidentData: any, resolve: (id: string) => void }) {
  const { isScanning, dangerZones, optimalRoute } = useTactical();
  
  return (
    <div className="h-full flex flex-col gap-4 animate-in slide-in-from-right duration-700">
      <div className="glass-panel p-4 rounded-[2rem] tactical-border border-indigo-500/30 bg-indigo-500/5">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
               {isScanning ? (
                 <BrainCircuit className="w-6 h-6 text-white animate-pulse" />
               ) : (
                 <Navigation className="w-6 h-6 text-white animate-pulse" />
               )}
            </div>
            <div className="flex-1">
               <h2 className="text-lg font-black text-white uppercase tracking-tight">
                 {isScanning ? "Scanning Path..." : "Escape Protocol"}
               </h2>
               <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest">
                 {isScanning ? "Detecting Dangers // Optimizing" : "Follow Mesh Beacon v2 // Evacuating"}
               </p>
            </div>
            <button onClick={() => resolve(activeIncidentId)} className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
         </div>
      </div>

      <div className="flex-1 min-h-0 relative rounded-[2rem] overflow-hidden border border-white/5 bg-slate-950/40 shadow-inner">
         <VenueMap minimal />
         
         <AnimatePresence>
           {isScanning && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-slate-950/80 backdrop-blur-sm"
             >
                <div className="w-24 h-24 relative">
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-0 border-2 border-dashed border-indigo-500/30 rounded-full"
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-indigo-400 animate-bounce" />
                   </div>
                </div>
                <div className="text-center">
                   <p className="text-[9px] font-mono text-indigo-500 uppercase tracking-[0.4em] font-black">QuantumLink_Scan_Active</p>
                </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      <div className="h-[200px] flex gap-4">
        <div className="flex-1">
          <CrisisChat emergencyId={activeIncidentId} role="guest" />
        </div>
        
        {dangerZones.length > 0 && (
          <div className="w-64 glass-panel p-4 rounded-[2rem] tactical-border overflow-y-auto scrollbar-hide">
             <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3 px-1">Detected Hazards</span>
             <div className="space-y-2">
                {dangerZones.map((zone) => (
                  <div key={zone.id} className="flex items-center gap-3 p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                     <AlertCircle className="w-3 h-3 text-red-500" />
                     <span className="text-[9px] font-bold text-white uppercase truncate">{zone.label}</span>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
