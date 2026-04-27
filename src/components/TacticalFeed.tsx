
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Terminal, Shield, Zap, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const MOCK_SYSTEM_MESSAGES = [
  "MESH_NODE_SIG_04: RE-ESTABLISHED",
  "PERSONNEL_SYNC: AGENT_ACTIVE",
  "ENCRYPTION_KEY_ROTATED: 2048_BIT",
  "ENVIRONMENT_SCAN: NOMINAL",
  "UPLINK_STABLE: 1.2GBPS_MESH",
  "SYSTEM_DIAGNOSTIC: ALL_NODES_GREEN"
];

export default function TacticalFeed() {
  const [logs, setLogs] = useState<{id: string, text: string, type: 'info' | 'warn' | 'alert', time: string}[]>([]);

  useEffect(() => {
    // 1. Unified Firestore Listener
    const q = query(
      collection(db, 'emergencies'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && !change.doc.metadata.hasPendingWrites) {
          const data = change.doc.data();
          const newLog = {
            id: change.doc.id,
            text: `ALERT: ${data.type.toUpperCase()} DETECTED @ ${data.userName || 'unknown'}`,
            type: (data.severity === 'critical' || data.severity === 'high') ? 'alert' : 'warn' as any,
            time: new Date().toLocaleTimeString([], { hour12: false })
          };
          
          setLogs(prev => [newLog, ...prev.slice(0, 11)]);
          if (newLog.type === 'alert') TacticalAudio.playBlip(600, 0.1);
        }
      });
    });

    // 2. Background Task Simulation (Noise)
    const interval = setInterval(() => {
      const msg = MOCK_SYSTEM_MESSAGES[Math.floor(Math.random() * MOCK_SYSTEM_MESSAGES.length)];
      setLogs(prev => [
        { 
          id: Math.random().toString(36), 
          text: msg, 
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour12: false })
        },
        ...prev.slice(0, 11)
      ]);
    }, 8000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="glass-panel border-white/5 rounded-[2rem] p-6 h-full flex flex-col gap-4 overflow-hidden bg-slate-950/30 backdrop-blur-3xl relative">
       <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0)_50%,rgba(0,0,0,0.4)_100%),linear-gradient(90deg,rgba(0,0,0,0),rgba(99,102,241,0.05),rgba(0,0,0,0))] pointer-events-none" />
       
       <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
             <div className="w-1 h-4 bg-indigo-500 rounded-full animate-pulse" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">TACTICAL_FEED</h2>
          </div>
          <div className="flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[8px] font-mono text-emerald-500/70 font-bold">UPLINK_OK</span>
          </div>
       </div>

       <div className="flex-1 font-mono space-y-1 relative z-10">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10, filter: 'blur(5px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: 10, filter: 'blur(5px)' }}
                className={cn(
                  "text-[9px] px-2 py-1.5 rounded flex items-center gap-2 font-bold transition-colors",
                  log.type === 'alert' ? "bg-red-500/10 text-red-400 border-l-2 border-red-500" :
                  log.type === 'warn' ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500" :
                  "text-slate-400 border-l-2 border-slate-800"
                )}
              >
                {log.type === 'alert' ? <AlertCircle className="w-2.5 h-2.5" /> : 
                 log.type === 'warn' ? <Shield className="w-2.5 h-2.5" /> : 
                 <Terminal className="w-2.5 h-2.5 opacity-50" />}
                <span className="opacity-50">[{log.time}]</span>
                <span className="tracking-tight">{log.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
       </div>

       <div className="mt-2 pt-4 border-t border-white/5 flex items-center gap-4 text-[7px] font-mono text-slate-600 uppercase tracking-widest relative z-10">
          <div className="flex items-center gap-1.5">
             <Zap className="w-2.5 h-2.5 text-indigo-500" />
             LATENCY: 12ms
          </div>
          <div className="flex items-center gap-1.5">
             <Shield className="w-2.5 h-2.5 text-emerald-500" />
             THREAT: NIL
          </div>
       </div>
    </div>
  );
}
