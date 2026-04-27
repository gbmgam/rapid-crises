import React from 'react';
import { Shield, EyeOff, Trash2, Clock, Check, AlertTriangle } from 'lucide-react';
import { useTactical } from '../contexts/TacticalContext';
import { motion } from 'motion/react';

export function PrivacyDashboard() {
  const { 
    isStealthMode, setIsStealthMode, 
    privacyConsent, setPrivacyConsent,
    dataRetention, setDataRetention,
    clearTacticalHistory 
  } = useTactical();

  return (
    <div className="p-6 space-y-8 bg-zinc-900 min-h-screen text-zinc-100">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold tracking-tight">Privacy & Security</h1>
        </div>
        <p className="text-zinc-400">Control your tactical footprint and mesh telemetry.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Active Protections</h2>
        
        <div className="grid gap-4">
          {/* Stealth Mode */}
          <div className={`p-4 rounded-xl border transition-all ${isStealthMode ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-zinc-800/50 border-zinc-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isStealthMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-700 text-zinc-400'}`}>
                  <EyeOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">Stealth Mode</h3>
                  <p className="text-xs text-zinc-400">Disable background telemetry and location pulse.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsStealthMode(!isStealthMode)}
                className={`relative w-12 h-6 rounded-full transition-colors ${isStealthMode ? 'bg-cyan-500' : 'bg-zinc-600'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isStealthMode ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>

          {/* Privacy Consent */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-700 text-zinc-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">System Authorization</h3>
                  <p className="text-xs text-zinc-400">Allow AI to analyze mesh data for threat prediction.</p>
                </div>
              </div>
              <button 
                onClick={() => setPrivacyConsent(!privacyConsent)}
                className={`relative w-12 h-6 rounded-full transition-colors ${privacyConsent ? 'bg-green-600' : 'bg-zinc-600'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${privacyConsent ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Data Management</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="font-medium">Retention Policy</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['session', '30days', 'permanent'] as const).map((policy) => (
                <button
                  key={policy}
                  onClick={() => setDataRetention(policy)}
                  className={`py-2 px-3 rounded-lg border text-xs capitalize transition-all ${
                    dataRetention === policy 
                      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-bold' 
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {policy === '30days' ? '30 Days' : policy}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => {
              if (confirm('Irreversibly clear all tactical session data?')) {
                clearTacticalHistory();
              }
            }}
            className="w-full p-4 rounded-xl bg-red-950/20 border border-red-500/50 flex items-center justify-between group hover:bg-red-900/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400 group-hover:scale-110 transition-transform">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-red-100">Wipe Data Flow</h3>
                <p className="text-xs text-red-400/80">Clear alerts, sensors, and route cache.</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <footer className="mt-auto pt-8 border-t border-zinc-800">
        <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Privacy controls are local to this terminal. Emergency SOS triggers always bypass stealth mode for immediate responder coordination. 
            All telemetry is end-to-end encrypted across the mesh network.
          </p>
        </div>
      </footer>
    </div>
  );
}
