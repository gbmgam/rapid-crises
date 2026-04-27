import { ReactNode, useState, useEffect } from "react";
import { 
  Shield, 
  Settings, 
  LayoutDashboard, 
  Map as MapIcon, 
  LogOut,
  Bell,
  Menu,
  X,
  AlertTriangle,
  Hourglass,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import VoiceAssistant from "./VoiceAssistant";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { user, profile, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'sos', label: 'SOS Center', icon: AlertTriangle, roles: ['guest', 'staff', 'admin'] },
    { id: 'safety', label: 'Safety Mode', icon: Hourglass, roles: ['guest', 'staff', 'admin'] },
    { id: 'map', label: 'Safety Map', icon: MapIcon, roles: ['guest', 'staff', 'admin'] },
    { id: 'dashboard', label: 'Ops Dashboard', icon: LayoutDashboard, roles: ['staff', 'admin', 'superadmin'] },
    { id: 'personnel', label: 'Personnel', icon: Users, roles: ['admin', 'superadmin'] },
    { id: 'admin', label: 'Admin Panel', icon: Shield, roles: ['admin', 'superadmin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['guest', 'staff', 'admin'] },
  ].filter(tab => tab.roles.includes(profile?.role));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e293b_0%,transparent_100%)] opacity-30" />
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('sos')}>
            <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center font-black text-indigo-500 shadow-2xl group-hover:border-indigo-500/50 transition-all relative overflow-hidden">
              <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-[0.2em] text-sm text-white uppercase italic">
                Quantum<span className="text-indigo-500">Link</span>
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold">Tactical_Mesh_Command</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-5 py-2 rounded-xl transition-all flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.25em] border relative overflow-hidden",
                  activeTab === tab.id 
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30" 
                    : "text-slate-500 border-transparent hover:bg-slate-900/50 hover:text-slate-300"
                )}
              >
                <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-white" : "text-slate-600")} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="nav-active" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white/40 blur-[1px]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-900/50 border border-slate-800/50 rounded-xl backdrop-blur-sm">
              <div className="flex flex-col text-right">
                <span className="text-[8px] font-mono text-emerald-500 font-black uppercase tracking-widest">Edge_Node_Alpha</span>
                <span className="text-[7px] font-mono text-slate-600 uppercase">Latency: 1.2ms</span>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            </div>
            
            <div className="flex items-center gap-2">
               <button className="p-2.5 text-slate-500 hover:text-indigo-400 transition-colors relative bg-slate-900/30 border border-slate-800/50 rounded-xl group">
                 <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" />
                 <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
               </button>
               
               {user && (
                 <button 
                  onClick={() => setActiveTab('settings')}
                  className="w-9 h-9 rounded-lg overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-all shrink-0 bg-slate-900 flex items-center justify-center p-0.5"
                 >
                   {user.photoURL ? (
                     <img src={user.photoURL} alt="User" className="w-full h-full object-cover rounded-md" referrerPolicy="no-referrer" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-md">
                       <span className="text-[10px] font-black text-indigo-500">{user.displayName?.charAt(0) || user.email?.charAt(0)}</span>
                     </div>
                   )}
                 </button>
               )}

               <button 
                  onClick={() => logout()}
                  className="hidden sm:flex p-2.5 text-slate-500 hover:text-red-400 transition-colors bg-slate-900/30 border border-slate-800/50 rounded-xl group"
                  title="Force Terminate Session"
               >
                  <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
               </button>
            </div>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-slate-500"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-slate-950 pt-20 px-4 md:hidden"
          >
            <div className="flex flex-col gap-2">
              {user && (
                <div className="flex items-center gap-4 px-4 py-6 border-b border-white/5 mb-2">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-sm font-black text-indigo-500">{user.displayName?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white uppercase italic">{user.displayName || 'Unknown Operative'}</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{user.email}</div>
                  </div>
                </div>
              )}
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-4 rounded-xl transition-all flex items-center gap-4 text-sm font-bold uppercase tracking-widest",
                    activeTab === tab.id 
                      ? "bg-indigo-600 text-white" 
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
              <button 
                onClick={() => logout()}
                className="w-full mt-4 px-4 py-4 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-4 text-sm font-bold uppercase tracking-widest"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-20 pb-12 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4">
          {children}
        </div>
      </main>

      <footer className="fixed bottom-0 w-full h-8 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex gap-4">
          <span>EDGE_NODE: 0x82f..4a2</span>
          <span className="hidden sm:inline">LAT: 40.712° N</span>
          <span className="hidden sm:inline">LNG: 74.006° W</span>
        </div>
        <div className="flex gap-4">
          <span className="text-indigo-400 uppercase tracking-tighter">QUANTUM_LINK_V2.0.4-STABLE</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> 
            SYSTEM ENCRYPTED
          </span>
        </div>
      </footer>

      <VoiceAssistant onCommand={setActiveTab} activeTab={activeTab} />
    </div>
  );
}
