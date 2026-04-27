import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTactical } from '../contexts/TacticalContext';
import { Shield, ShieldCheck, Map, Mic, Wifi, Activity, Bell, ChevronRight, Globe, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';

export default function Onboarding() {
  const { 
    language, setLanguage, 
    consent, setConsent, 
    completeTutorial,
    anonId
  } = useTactical();
  
  const [step, setStep] = useState(0);
  const [testSuccess, setTestSuccess] = useState(false);

  React.useEffect(() => {
    if (step === 3 && consent.microphone) {
      const { VoiceIntelligence } = require('../services/voiceService');
      VoiceIntelligence.start();
      const unsub = VoiceIntelligence.subscribe((cmd: string) => {
        if (cmd.includes('guardian test')) {
          setTestSuccess(true);
          TacticalAudio.playConfirm();
        }
      });
      return () => {
        unsub();
        VoiceIntelligence.stop();
      };
    }
  }, [step, consent.microphone]);

  const steps = [
    { id: 'language', title: 'Tactical Uplink' },
    { id: 'privacy', title: 'Data Sovereignty' },
    { id: 'tutorial', title: 'Safety Protocol' },
    { id: 'mic_test', title: 'Link Verification' }
  ];

  const handleNext = () => {
    TacticalAudio.playConfirm();
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      completeTutorial();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col overflow-hidden">
      {/* HUD Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest leading-tight">Guardian <span className="text-indigo-400">Mesh</span></h1>
            <p className="text-[10px] text-slate-500 font-mono italic uppercase">Initial Initialization Sequence</p>
          </div>
        </div>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={cn(
              "w-8 h-1 rounded-full transition-all duration-500",
              i <= step ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "bg-slate-800"
            )} />
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="lang"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col justify-center gap-8"
            >
              <div className="space-y-2">
                <Globe className="w-12 h-12 text-indigo-500 opacity-50 mb-4" />
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Sector <span className="text-indigo-500">Language</span> Selection</h2>
                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Select localized interface packages</p>
              </div>

              <div className="grid gap-3">
                {[
                  { id: 'en', label: 'English', desc: 'International Standard' },
                  { id: 'es', label: 'Español', desc: 'Localized Beta 1' },
                  { id: 'hi', label: 'हिन्दी', desc: 'Localized Beta 2' }
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                        setLanguage(lang.id as any);
                        TacticalAudio.playBlip();
                    }}
                    className={cn(
                      "p-6 rounded-2xl border transition-all text-left flex items-center justify-between",
                      language === lang.id 
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/20" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80"
                    )}
                  >
                    <div>
                      <span className="block font-black uppercase text-sm tracking-widest">{lang.label}</span>
                      <span className="text-[10px] opacity-60 font-mono uppercase">{lang.desc}</span>
                    </div>
                    {language === lang.id && <CheckCircle2 className="w-5 h-5 text-white" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div 
              key="consent"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-8 py-4"
            >
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Mesh <span className="text-indigo-500">Permissions</span></h2>
                <p className="text-slate-500 text-xs italic font-medium">Data sent only during active alerts. Auto-deletion after 24h.</p>
              </div>

              <div className="grid gap-3">
                {[
                  { id: 'location', label: 'Precision GPS', icon: Map, color: 'text-blue-500', desc: 'Uplink real-time coordinates during distress.' },
                  { id: 'microphone', label: 'Acoustics Monitor', icon: Mic, color: 'text-purple-500', desc: 'Peak ambient measurement & voice triggers.' },
                  { id: 'connectivity', label: 'Crowd Mesh', icon: Wifi, color: 'text-emerald-500', desc: 'Wi-Fi/BT scanning for density estimation.' },
                  { id: 'motion', label: 'Kinetic Link', icon: Activity, color: 'text-amber-500', desc: 'Fall detection & stealth shake triggers.' },
                  { id: 'notifications', label: 'Priority Relay', icon: Bell, color: 'text-indigo-500', desc: 'Evasion route updates & responder ETA.' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setConsent({ ...consent, [item.id]: !consent[item.id] });
                        TacticalAudio.playBlip(1400, 0.05);
                      }}
                      className={cn(
                        "p-4 rounded-xl border transition-all text-left flex items-start gap-4",
                        consent[item.id] 
                          ? "bg-slate-900 border-indigo-500/40" 
                          : "bg-slate-900/40 border-slate-800"
                      )}
                    >
                      <div className={cn("mt-1 p-2 rounded-lg bg-slate-950", item.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-white uppercase tracking-widest">{item.label}</span>
                          <div className={cn(
                            "w-8 h-4 rounded-full relative transition-all",
                            consent[item.id] ? "bg-indigo-600" : "bg-slate-700"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                              consent[item.id] ? "right-0.5" : "left-0.5"
                            )} />
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal mt-1">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="tutorial"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-8 py-8"
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-6 leading-none">Safety <span className="text-indigo-500">Tutorial</span></h2>
                
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Visible SOS</h4>
                        <p className="text-[11px] text-slate-400 mt-1">Tap the primary red trigger for a 3-second abort buffer before uplink.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Stealth Shake</h4>
                        <p className="text-[11px] text-slate-400 mt-1">Shake device 3 times for silent activation. Skips UI verification.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Voice Hotword</h4>
                        <p className="text-[11px] text-slate-400 mt-1">Say "Hey Guardian" followed by "Help" or "Cancel alert".</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <p className="text-[10px] text-indigo-300 font-mono uppercase">Encryption Node: {anonId}</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="test"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center gap-12 text-center"
            >
              <div className="space-y-4">
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full animate-ping" />
                    <div className="relative w-24 h-24 bg-slate-900 border-2 border-indigo-500 rounded-full flex items-center justify-center">
                        {testSuccess ? <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in" /> : <Mic className="w-10 h-10 text-indigo-400" />}
                    </div>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                  {testSuccess ? <span className="text-emerald-500">Link Verified</span> : <>Test <span className="text-indigo-500">Comm-Link</span></>}
                </h2>
                <p className="text-slate-400 text-sm max-w-[240px] leading-relaxed uppercase tracking-widest mx-auto">
                    {testSuccess 
                      ? "Acoustic resonance confirmed. Uplink stable."
                      : <>Say <span className="text-white bg-indigo-600 px-2 font-mono">"Guardian Test"</span> to verify microphone uplink</>
                    }
                </p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                    <motion.div 
                        animate={{ width: ["0%", "40%", "10%", "80%", "30%"] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="h-full bg-indigo-500" 
                    />
                </div>
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em]">Awaiting Spectral Resonance</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Nav */}
      <div className="p-6 bg-slate-950 border-t border-white/5">
        <button 
          onClick={handleNext}
          className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {step === steps.length - 1 ? 'Activate Mesh Integration' : 'Continue Sequence'}
          <ChevronRight className="w-4 h-4" />
        </button>
        <p className="text-center mt-4 text-[9px] text-slate-500 uppercase tracking-widest font-mono">ID Correlation: {anonId}</p>
      </div>
    </div>
  );
}
