import { motion, AnimatePresence } from 'motion/react';
import { User, Shield, Lock, ChevronRight, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';

export default function RoleSelection() {
  const { updateRole, user } = useAuth();

  const handleRoleSelection = (role: 'guest' | 'staff' | 'admin') => {
    TacticalAudio.playConfirm();
    updateRole(role);
  };

  const roles = [
    {
      id: 'guest',
      title: 'Civilian / Guest',
      description: 'Access emergency SOS, silent reporting, and indoor navigation.',
      icon: User,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    {
      id: 'staff',
      title: 'Staff / Responder',
      description: 'Access tactical dashboard, mesh alerts, and triage controls.',
      icon: Shield,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20'
    },
    {
      id: 'admin',
      title: 'Admin / Command',
      description: 'Full system authorization, node management, and audit logs.',
      icon: Lock,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
    }
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-12 relative overflow-hidden">
      {/* Background HUD Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:48px:48px] opacity-20" />
      <motion.div 
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent z-0 pointer-events-none"
      />
      
      <div className="text-center space-y-4 max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-4"
        >
          <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-400">Security Terminal Active</span>
        </motion.div>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase transition-all">
          Authorize <span className="text-indigo-500">Node</span> Access
        </h1>
        <p className="text-slate-500 text-xs font-mono uppercase tracking-[0.3em] leading-relaxed">
          Logged in as: <span className="text-slate-300">{user?.email}</span>
          <br />Select your operational role to initialize protocol.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full relative z-10">
        {roles.map((role, idx) => (
          <motion.button
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => handleRoleSelection(role.id as any)}
            className={cn(
              "p-8 rounded-[2.5rem] bg-slate-900 border text-left flex flex-col gap-6 transition-all group hover:scale-[1.02] active:scale-95 shadow-2xl overflow-hidden relative",
              role.border
            )}
          >
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", role.bg)}>
              <role.icon className={cn("w-32 h-32 opacity-10", role.color)} />
            </div>

            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner relative z-10", role.bg, role.border)}>
              <role.icon className={cn("w-7 h-7", role.color)} />
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{role.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{role.description}</p>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-white transition-colors">Initialize</span>
              <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-white transition-colors" />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity cursor-help">
        <Shield className="w-3 h-3 text-slate-500" />
        <span className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">QuantumLink Secure Protocol v2.4</span>
      </div>
    </div>
  );
}
