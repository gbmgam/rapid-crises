import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, ShieldCheck, Timer, AlertCircle, ChevronRight, Hourglass, Shield } from 'lucide-react';
import { useTactical } from '../contexts/TacticalContext';
import { motion, AnimatePresence } from 'motion/react';
import { TacticalAudio } from '../lib/audio';
import { useNotify } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';

export default function SafetyMode() {
  const { safetyTimer, setSafetyTimer, triggerEmergency, activeIncidentId } = useTactical();
  const { notify } = useNotify();
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdownToAlert, setCountdownToAlert] = useState(30);

  const options = [
    { label: '5 Minutes', value: 300, desc: 'Quick transit / Short duration solo task' },
    { label: '15 Minutes', value: 900, desc: 'Extended solo movement in low-light zones' },
    { label: '30 Minutes', value: 1800, desc: 'Full mission duration / High-risk area transit' },
  ];

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Dead Man's Switch Expiry Logic
  useEffect(() => {
    let interval: any;
    if (safetyTimer !== null && safetyTimer > 0) {
      interval = setInterval(() => {
        setSafetyTimer(safetyTimer - 1);
      }, 1000);
    } else if (safetyTimer === 0 && !activeIncidentId) {
      // Timer reached zero - enter 30s grace period
      if (countdownToAlert > 0) {
        if (countdownToAlert === 30) {
          TacticalAudio.playAlert();
          notify("Safety Timer Expired. Confirm safety immediately.", "error");
        }
        const graceInterval = setInterval(() => {
          setCountdownToAlert(prev => {
            if (prev <= 1) {
              clearInterval(graceInterval);
              triggerEmergency('unresponsive', 'Dead Man\'s Switch expiry - no user response');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(graceInterval);
      }
    }
    return () => clearInterval(interval);
  }, [safetyTimer, setSafetyTimer, triggerEmergency, activeIncidentId, countdownToAlert, notify]);

  const handleActivate = (val: number) => {
    TacticalAudio.playConfirm();
    setSafetyTimer(val);
    setCountdownToAlert(30);
    notify(`Safety Mode Engaged: ${val / 60}m countdown active.`, 'info');
  };

  const handleDeactivate = () => {
    TacticalAudio.playConfirm();
    setSafetyTimer(null);
    setCountdownToAlert(30);
    notify("Safety Mode Deactivated. Standing by.", 'info');
  };

  if (activeIncidentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
           <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Tactical Lock Active</h2>
        <p className="text-slate-500 text-sm max-w-xs mt-2">Safety Mode is disabled during active emergencies. Resolve current incident to resume monitoring.</p>
      </div>
    );
  }

  if (safetyTimer === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-red-950/20 rounded-[3rem] border-2 border-red-500 animate-pulse">
        <div className="text-8xl font-black text-red-500 mb-8">{countdownToAlert}</div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-4">Are You Safe?</h2>
        <p className="text-red-200/70 text-center text-sm max-w-xs mb-12 uppercase font-black tracking-widest leading-relaxed">
          Uplinking emergency metadata in {countdownToAlert} seconds unless cancelled.
        </p>
        <button 
          onClick={handleDeactivate}
          className="w-full max-w-xs py-6 bg-white text-red-600 font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-95 transition-all text-xl"
        >
          I AM SAFE
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Safety <span className="text-indigo-500">Mode</span></h1>
        <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.4em]">Feature: Dead_Man_Switch_v2.1</p>
      </div>

      {safetyTimer === null ? (
        <div className="space-y-6">
          <div className="p-8 glass-panel tactical-border rounded-[3rem] bg-indigo-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Shield className="w-24 h-24 text-indigo-500" />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 relative z-10 font-medium">
              If the timer expires without manual confirmation, Guardian will automatically uplink your live location, noise levels, and mobility status to the tactical mesh.
            </p>
            
            <div className="space-y-3">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleActivate(opt.value)}
                  className="w-full p-6 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-indigo-500 transition-all hover:bg-slate-800"
                >
                  <div className="text-left">
                    <span className="block font-black text-white uppercase tracking-widest text-sm">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">{opt.desc}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-start gap-4 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
             <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-amber-200/70 font-mono uppercase leading-normal">
               Note: Deactivating the timer requires the same biometric/PIN credentials as your device unlock.
             </p>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-8"
        >
          <div className="relative aspect-square max-w-[320px] mx-auto flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border-[12px] border-slate-900" />
             <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * (safetyTimer / 1800))}
                  className="text-indigo-500 transition-all duration-1000"
                />
             </svg>
             <div className="text-center relative">
                <div className="text-6xl font-black text-white tabular-nums tracking-tighter mb-2">
                   {formatTime(safetyTimer)}
                </div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">System_Watching</div>
             </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleDeactivate}
              className="w-full py-6 bg-slate-100 text-slate-950 font-black uppercase tracking-[0.3em] rounded-3xl shadow-xl shadow-white/5 active:scale-95 transition-all"
            >
              I AM SAFE
            </button>
            <button 
              onClick={() => triggerEmergency('unresponsive', 'Manual escalation via Safety Mode')}
              className="w-full py-4 bg-red-600/10 text-red-500 font-black uppercase tracking-[0.3em] rounded-2xl border border-red-500/20 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <ShieldAlert className="w-4 h-4" />
              Escalate Immediately
            </button>
          </div>

          <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
             <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <div className="flex-1">
                   <div className="text-[10px] font-black text-white uppercase tracking-widest">Active Monitoring Link</div>
                   <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Uplinking heartbeats to sector_g every 120s</div>
                </div>
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
