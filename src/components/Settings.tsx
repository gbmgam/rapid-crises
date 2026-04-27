import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  Bluetooth, 
  Monitor, 
  ShieldCheck, 
  Locate, 
  ChevronRight, 
  Settings as SettingsIcon,
  ToggleLeft as Toggle,
  ToggleRight as ToggleActive,
  Signal,
  Check,
  Eye,
  Smartphone,
  User,
  Image as ImageIcon,
  Save,
  Loader2,
  Users,
  LogOut,
  Shield,
  Fingerprint,
  Mail,
  Lock,
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTactical } from '../contexts/TacticalContext';
import { useNotify } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import EmergencyContacts from './EmergencyContacts';

interface SettingCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORIES: SettingCategory[] = [
  { id: 'profile', title: 'User Profile', icon: <User className="w-5 h-5" />, description: 'Update your tactical identity and visual uplink.' },
  { id: 'contacts', title: 'Emergency Contacts', icon: <Users className="w-5 h-5" />, description: 'Authorized guardians for automated alerting.' },
  { id: 'network', title: 'WiFi & Network', icon: <Wifi className="w-5 h-5" />, description: 'Manage mesh connectivity and edge uplinks.' },
  { id: 'display', title: 'Display & Appearance', icon: <Monitor className="w-5 h-5" />, description: 'HUD themes, transparency, and retinal scaling.' },
  { id: 'privacy', title: 'Privacy & Security', icon: <ShieldCheck className="w-5 h-5" />, description: 'Encryption keys and stealth mode protocols.' },
];

export default function Settings() {
  const { user, profile, updateRole, updateUserProfile, logout, convertToAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { privacyConsent, setPrivacyConsent } = useTactical();
  const { notify } = useNotify();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  
  // Profile Form State
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editPhoto, setEditPhoto] = useState(user?.photoURL || '');

  // Convert account form
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPass, setConvertPass] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateUserProfile(editName, editPhoto);
      notify("Tactical Profile Uplinked Successfully", "success");
    } catch (err) {
      notify("Uplink Failure: Profile synchronization failed", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConverting(true);
    try {
      await convertToAccount(convertEmail, convertPass);
      notify("Guest Account Uplinked to Cloud", "success");
    } catch (err) {
      notify("Conversion Failure", "error");
    } finally {
      setIsConverting(false);
    }
  };

  const [switches, setSwitches] = useState<Record<string, boolean>>({
    wifi: true,
    bluetooth: false,
    stealth: true,
    gps: true,
    highAccuracy: true,
    autoTheme: true,
  });

  const toggle = (id: string) => {
    setSwitches(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderContent = () => {
    switch (activeCategory) {
      case 'profile':
        return (
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-6 pb-8 border-b border-white/5">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-indigo-500/30 bg-slate-900 shadow-2xl group-hover:border-indigo-500 transition-all">
                  {editPhoto || user?.photoURL ? (
                    <img src={editPhoto || user?.photoURL || ''} alt="Uplink" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white border-4 border-slate-950 shadow-lg cursor-pointer hover:bg-indigo-500 transition-colors">
                  <ImageIcon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-center">
                <h4 className="text-lg font-black text-white uppercase tracking-tight">{user?.displayName || 'Unknown Operative'}</h4>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{user?.email || 'OFFLINE_GUEST_ENTRY'}</p>
                <div className="mt-2 flex justify-center gap-2">
                   <span className={cn(
                     "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border",
                     user?.isAnonymous 
                       ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                       : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                   )}>
                     {user?.isAnonymous ? 'Guest Node' : 'Registered Node'}
                   </span>
                   <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[7px] font-black uppercase tracking-widest">
                     ID: {profile?.anon_id}
                   </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
               <div className="grid grid-cols-1 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Designation (Display Name)</label>
                   <div className="glass-panel bg-slate-950/40 border-slate-800 rounded-2xl flex items-center px-4 focus-within:border-indigo-500/50 transition-all tactical-border">
                     <User className="w-4 h-4 text-slate-600 mr-3" />
                     <input 
                       type="text"
                       value={editName}
                       onChange={(e) => setEditName(e.target.value)}
                       className="w-full py-4 bg-transparent border-none text-sm font-black tracking-tight text-white focus:outline-none placeholder:text-slate-700"
                       placeholder="Enter designation..."
                     />
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Visual Uplink URL (Avatar)</label>
                   <div className="glass-panel bg-slate-950/40 border-slate-800 rounded-2xl flex items-center px-4 focus-within:border-indigo-500/50 transition-all tactical-border">
                     <Globe className="w-4 h-4 text-slate-600 mr-3" />
                     <input 
                       type="text"
                       value={editPhoto}
                       onChange={(e) => setEditPhoto(e.target.value)}
                       className="w-full py-4 bg-transparent border-none text-sm font-black tracking-tight text-white focus:outline-none placeholder:text-slate-700 font-mono"
                       placeholder="https://images.unsplash.com/..."
                     />
                   </div>
                 </div>
               </div>

               <button 
                 type="submit"
                 disabled={isUpdating}
                 className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
               >
                 {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                 Commit Profile Delta
               </button>
            </form>

            {user?.isAnonymous && (
              <div className="pt-8 border-t border-white/5 space-y-6">
                 <div className="space-y-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">Sync Mesh to Cloud</h4>
                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Convert guest session into persistent registered node.</p>
                 </div>
                 <form onSubmit={handleConvert} className="space-y-4">
                    <div className="relative">
                       <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                       <input 
                         type="email"
                         value={convertEmail}
                         onChange={(e) => setConvertEmail(e.target.value)}
                         placeholder="EMAIL@PROTOCOL.NET"
                         className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-[10px] font-mono text-white placeholder:text-slate-700"
                         required
                       />
                    </div>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                       <input 
                         type="password"
                         value={convertPass}
                         onChange={(e) => setConvertPass(e.target.value)}
                         placeholder="NEW_AUTHLINK_PASS"
                         className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-[10px] font-mono text-white placeholder:text-slate-700"
                         required
                       />
                    </div>
                    <button 
                      type="submit"
                      disabled={isConverting}
                      className="w-full py-3 bg-slate-800 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                    >
                      {isConverting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Link Guest to Permanent Node"}
                    </button>
                 </form>
              </div>
            )}
          </div>
        );
      case 'contacts':
        return <EmergencyContacts />;
      case 'network':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">Mesh Network</h4>
                  <p className="text-[10px] text-slate-500 font-mono">STATUS: CONNECTED (QUANTUM-Z)</p>
                </div>
              </div>
              <button 
                onClick={() => toggle('wifi')}
                className="text-indigo-500 transition-colors"
              >
                {switches.wifi ? <ToggleActive className="w-8 h-8" /> : <Toggle className="w-8 h-8 text-slate-600" />}
              </button>
            </div>
            
            <div className="space-y-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">Available Nodes</span>
              <div className="space-y-1">
                {['QUANTUM_LINK_HQ', 'EDGE_NODE_04', 'CIVIC_MESH_S2'].map(node => (
                  <div key={node} className="flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-white/5 hover:bg-slate-900/60 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Signal className="w-4 h-4 text-slate-600 group-hover:text-indigo-400" />
                      <span className="text-xs font-mono text-slate-300">{node}</span>
                    </div>
                    <Lock className="w-3 h-3 text-slate-700" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'bluetooth':
        return (
          <div className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">Tactical Radio</h4>
                  <p className="text-[10px] text-slate-500 font-mono">SCANNING FOR BIOMETRICS...</p>
                </div>
              </div>
              <button 
                onClick={() => toggle('bluetooth')}
                className="text-blue-500 transition-colors"
              >
                {switches.bluetooth ? <ToggleActive className="w-8 h-8" /> : <Toggle className="w-8 h-8 text-slate-600" />}
              </button>
            </div>

            <div className="p-8 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800">
               <Smartphone className="w-8 h-8 text-slate-700 mx-auto mb-3 animate-pulse" />
               <p className="text-[10px] text-slate-500 font-mono uppercase">Ensure device mesh isolation is disabled for local discovery.</p>
            </div>
          </div>
        );
      case 'display':
        const themeOptions = [
          { id: 'light', label: 'Luminous', icon: <Eye className="w-5 h-5" />, desc: 'High visibility daylight mode.' },
          { id: 'dark', label: 'Nocturnal', icon: <Lock className="w-5 h-5" />, desc: 'Standard low-light operation.' },
          { id: 'tactical', label: 'Tactical HUD', icon: <Monitor className="w-5 h-5" />, desc: 'Full-mesh sensor augmentation.' },
        ];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
               {themeOptions.map(opt => (
                 <button 
                  key={opt.id} 
                  onClick={() => setTheme(opt.id as any)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                    theme === opt.id 
                      ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-600/10" 
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                  )}
                 >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      theme === opt.id ? "bg-indigo-600 text-white" : "bg-slate-950 text-slate-600 group-hover:text-slate-400"
                    )}>
                       {opt.icon}
                    </div>
                    <div>
                      <span className={cn(
                        "block text-xs font-black uppercase tracking-widest mb-0.5",
                        theme === opt.id ? "text-white" : "text-slate-400"
                      )}>{opt.label}</span>
                      <span className="block text-[10px] text-slate-500 font-mono italic">{opt.desc}</span>
                    </div>
                 </button>
               ))}
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
               <span className="text-xs font-bold text-white uppercase">Retinal Scaling</span>
               <button onClick={() => toggle('retinalScaling')}>
                  {switches.retinalScaling ? <ToggleActive className="w-8 h-8 text-indigo-500" /> : <Toggle className="w-8 h-8 text-slate-600" />}
               </button>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-4">
               <div className="flex items-center gap-3 text-red-500">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Advanced Encryption</span>
               </div>
               <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                 All mesh communication is end-to-end encrypted with rotating ephemeral keys. Your physical identity is masked behind a tactical UID.
               </p>
               <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all">
                  Rotate Mesh Keys
               </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
               <div>
                  <h4 className="text-xs font-bold text-white uppercase">Stealth Mode</h4>
                  <p className="text-[9px] text-slate-500 font-mono">REDUCE NETWORK SIGNATURE</p>
               </div>
               <button onClick={() => toggle('stealth')}>
                  {switches.stealth ? <ToggleActive className="w-8 h-8 text-emerald-500" /> : <Toggle className="w-8 h-8 text-slate-600" />}
               </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
               <div className="flex-1 pr-4">
                  <h4 className="text-xs font-bold text-white uppercase">Tactical Consent</h4>
                  <p className="text-[9px] text-indigo-300 font-mono leading-tight mt-1">SHARE BIOMETRICS & LOCATION WITH RESPONDERS EXCLUSIVELY DURING EMERGENCY PROTOCOLS</p>
               </div>
               <button onClick={() => setPrivacyConsent(!privacyConsent)}>
                  {privacyConsent ? <ToggleActive className="w-8 h-8 text-indigo-500" /> : <Toggle className="w-8 h-8 text-slate-600" />}
               </button>
            </div>
          </div>
        );
      case 'location':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                  <Locate className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">Mesh GPS</h4>
                  <p className="text-[10px] text-slate-500 font-mono">LAT: 35.6812 // LNG: 139.7671</p>
                </div>
              </div>
              <button onClick={() => toggle('gps')}>
                {switches.gps ? <ToggleActive className="w-8 h-8 text-indigo-500" /> : <Toggle className="w-8 h-8 text-slate-600" />}
              </button>
            </div>
            
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-4">
               <h4 className="text-xs font-bold text-white uppercase">Positioning Precision</h4>
               <div className="flex gap-2">
                  {['Low Power', 'Balanced', 'High Precision'].map((mode, i) => (
                    <button 
                      key={mode}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all border",
                        i === 2 ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" : "bg-slate-950 text-slate-500 border-white/5"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
               <Globe className="w-4 h-4 text-indigo-400" />
               <p className="text-[9px] text-indigo-300 font-mono uppercase uppercase">Location remains local to your device unless SOS protocol is active.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[600px]">
      {/* Sidebar / Categories */}
      <div className="w-full md:w-80 space-y-3">
        <div className="flex items-center gap-4 mb-8 px-4">
           <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
              <SettingsIcon className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">System Settings</h2>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest tracking-widest">Configuration Console</p>
           </div>
        </div>

        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "w-full flex items-center justify-between p-5 rounded-[1.75rem] transition-all group border",
              activeCategory === cat.id 
                ? "bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:border-slate-700"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2.5 rounded-xl transition-colors",
                activeCategory === cat.id ? "bg-white/20" : "bg-slate-950"
              )}>
                {cat.icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold uppercase tracking-tight">{cat.title}</h3>
                <p className={cn(
                  "text-[9px] font-mono uppercase tracking-widest mt-0.5",
                  activeCategory === cat.id ? "text-indigo-100" : "text-slate-500"
                )}>
                  {cat.id === 'network' ? 'MESH: CONNECTED' : 'NOMINAL_STATUS'}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              activeCategory === cat.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
            )} />
          </button>
        ))}

        <div className="mt-8 space-y-3">
           <button 
             onClick={logout}
             className="w-full py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-3"
           >
             <LogOut className="w-4 h-4" />
             Terminate Session
           </button>
           <button 
             onClick={() => updateRole(null as any)}
             className="w-full py-4 bg-slate-950 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-all hover:bg-slate-900 flex items-center justify-center gap-3"
           >
             <Shield className="w-4 h-4" />
             Initialize Security Reset
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass-panel rounded-[3.5rem] border border-slate-800 overflow-hidden relative min-h-[500px]">
         <div className="absolute inset-0 bg-slate-950 opacity-20 pointer-events-none" />
         <div className="relative h-full flex flex-col">
            <AnimatePresence mode="wait">
               {activeCategory ? (
                 <motion.div
                   key={activeCategory}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   className="p-8 flex-1"
                 >
                    <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/5">
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setActiveCategory(null)}
                            className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors md:hidden"
                          >
                            <ChevronRight className="w-5 h-5 rotate-180" />
                          </button>
                          <div>
                             <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                               {CATEGORIES.find(c => c.id === activeCategory)?.title}
                             </h3>
                             <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                               {CATEGORIES.find(c => c.id === activeCategory)?.description}
                             </p>
                          </div>
                       </div>
                       <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                          >
                             <SettingsIcon className="w-5 h-5 text-slate-700" />
                          </motion.div>
                       </div>
                    </div>
                    {renderContent()}
                 </motion.div>
               ) : (
                 <motion.div 
                   key="empty"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                 >
                    <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-800 mb-6">
                       <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">Select System Node</h3>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-2 max-w-[240px] leading-relaxed">
                      Choose a category from the left to access low-level mesh configuration protocols.
                    </p>
                 </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}
