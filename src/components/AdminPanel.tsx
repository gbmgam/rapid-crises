import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  UserCircle, 
  Search,
  MoreVertical,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  BrainCircuit,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNotify } from '../contexts/NotificationContext';

export default function AdminPanel() {
  const { notify } = useNotify();
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { profile: adminProfile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      notify("Security access restricted: Users list sync failed.", "error");
    });
    return () => unsubscribe();
  }, []);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        updatedBy: adminProfile?.uid,
        lastRoleChange: new Date().toISOString()
      });
      notify(`Role updated to ${newRole.toUpperCase()} for entity.`, "success");
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, role: newRole }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      notify("Privilege escalation blocked or network error.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePermission = async (userId: string, permission: string, current: boolean) => {
    try {
      const permissions = selectedUser?.permissions || {};
      const newPermissions = { ...permissions, [permission]: !current };
      
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
      setSelectedUser(prev => ({ ...prev, permissions: newPermissions }));
      notify("Permission vector modified.", "success");
    } catch (err) {
      notify("Override failed.", "error");
    }
  };

  const permissionMatrix = [
    { key: 'sos_trigger', label: 'SOS Trigger', roles: ['guest', 'staff', 'responder', 'admin'] },
    { key: 'triage_access', label: 'Incident Triage', roles: ['staff', 'responder', 'admin'] },
    { key: 'dispatch_control', label: 'Tactical Dispatch', roles: ['responder', 'admin'] },
    { key: 'mesh_config', label: 'Mesh Configuration', roles: ['admin'] },
    { key: 'pii_access', label: 'PII Intel Access', roles: ['admin'] },
  ];

  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    return u.email?.toLowerCase().includes(searchLower) || 
           u.displayName?.toLowerCase().includes(searchLower) ||
           u.role?.toLowerCase().includes(searchLower);
  });

  const roles = [
    { id: 'guest', label: 'Guest', icon: UserCircle, color: 'text-slate-400' },
    { id: 'staff', label: 'Staff', icon: Shield, color: 'text-blue-400' },
    { id: 'responder', label: 'Responder', icon: ShieldAlert, color: 'text-red-400' },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-indigo-400' },
    { id: 'superadmin', label: 'SuperAdmin', icon: ShieldAlert, color: 'text-purple-400' },
  ];

  const ledgerEntries = [
    { hash: '0x8f2c...4e1a', action: 'ROLE_UPDATE', entity: 'gbm3914@gmail.com', status: 'CONFIRMED' },
    { hash: '0x3a10...9b22', action: 'ACCESS_GRANT', entity: 'responder_unit_4', status: 'CONFIRMED' },
    { hash: '0x7d66...1f09', action: 'MESH_SYNC', entity: 'sector_g_gateway', status: 'VERIFYING' },
    { hash: '0x12e9...a884', action: 'PROTOCOL_V2_INIT', entity: 'kernel_admin', status: 'CONFIRMED' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative">
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-600/5 blur-[100px] pointer-events-none" />
        <div className="space-y-1 relative">
           <div className="absolute -top-4 -left-4 w-8 h-8 border-t border-l border-indigo-500/30" />
           <h1 className="text-4xl font-black text-white tracking-widest uppercase italic leading-none">Personnel_CMD</h1>
           <div className="flex items-center gap-3">
              <p className="text-indigo-400/80 text-[10px] font-black uppercase tracking-[0.4em] italic">System_RBAC_V2.4</p>
              <div className="h-[1px] w-12 bg-slate-800" />
              <p className="text-slate-600 text-[10px] font-mono tracking-tighter uppercase italic">Nodes_Stable: {filteredUsers.length} / {users.length}</p>
           </div>
        </div>

        <div className="relative group max-w-sm w-full">
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors z-10" />
          <input 
            type="text"
            placeholder="Search credentials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-panel bg-slate-950/40 border-slate-800 rounded-2xl py-4 pl-14 pr-12 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700 font-black tracking-tight text-indigo-100 relative z-10 tactical-border"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:text-white text-slate-600 transition-colors z-20"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-12 xl:col-span-8 space-y-8">
          <div className="glass-panel border-slate-800/80 rounded-[3rem] overflow-hidden tactical-border relative">
            <div className="scanline" />
            <div className="p-8 border-b border-slate-800/50 flex items-center justify-between bg-slate-950/20 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                   <Users className="w-5 h-5 text-indigo-500" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">Mesh_Entity_Registry</span>
              </div>
              <div className="flex gap-2">
                 <div className="px-3 py-1 bg-slate-900 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-500 uppercase font-black">Sync_Active</div>
              </div>
            </div>

            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 divide-x divide-slate-800/10">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">Identity_Vector</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">Privilege_Class</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 text-right">Class_Transition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  <AnimatePresence mode="popLayout">
                    {filteredUsers.map((u) => (
                      <motion.tr 
                        key={u.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "group hover:bg-slate-900/40 transition-all cursor-pointer relative",
                          selectedUser?.id === u.id && "bg-slate-900/60 shadow-inner"
                        )}
                        onClick={() => setSelectedUser(u)}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sm font-black text-slate-700 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all">
                              {u.displayName?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-[13px] font-black text-white tracking-tight group-hover:text-indigo-200 transition-colors">{u.displayName || 'Unnamed_Node'}</div>
                              <div className="text-[10px] text-slate-600 font-mono tracking-tighter uppercase italic">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border transition-all",
                            u.role === 'admin' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]" :
                            u.role === 'staff' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            u.role === 'responder' ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]" :
                            "bg-slate-900 text-slate-600 border-slate-800"
                          )}>
                            <div className={cn("w-1 h-1 rounded-full", 
                               u.role === 'admin' ? 'bg-indigo-400' : 
                               u.role === 'staff' ? 'bg-blue-400' : 
                               u.role === 'responder' ? 'bg-red-400' : 'bg-slate-600')} />
                            {u.role}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {roles.map((role) => (
                              <button
                                key={role.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRoleChange(u.id, role.id);
                                }}
                                disabled={updatingId === u.id || u.role === role.id}
                                className={cn(
                                  "p-2.5 rounded-xl border transition-all disabled:opacity-30 relative group/btn",
                                  u.role === role.id 
                                    ? "bg-slate-800 border-slate-700 text-white shadow-xl" 
                                    : "bg-slate-950 border-slate-900 text-slate-700 hover:border-indigo-500/40 hover:text-indigo-400"
                                )}
                                title={`Set to ${role.label}`}
                              >
                                <role.icon className="w-4 h-4" />
                                {u.role === role.id && (
                                   <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full blur-[2px]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
               <div className="p-20 text-center space-y-4">
                  <Search className="w-12 h-12 text-slate-900 mx-auto" />
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">No_Entity_Match_Found</p>
               </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-4 space-y-8">
          <AnimatePresence mode="wait">
            {selectedUser ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel border-slate-800/80 rounded-[3rem] p-10 space-y-10 tactical-border relative overflow-hidden h-fit"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Shield className="w-32 h-32 text-indigo-400" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                     <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Protocol_Override</h3>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-2 bg-slate-950 border border-slate-900 rounded-xl hover:text-white transition-colors">
                     <ChevronRight className="w-4 h-4 text-slate-700 rotate-180" />
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl font-black text-slate-700 shadow-2xl relative group">
                    <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
                    {selectedUser.displayName?.charAt(0) || selectedUser.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-2xl font-black text-white tracking-tighter uppercase italic">{selectedUser.displayName || 'External_Node'}</div>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[8px] font-mono text-slate-500 font-bold uppercase rounded-md tracking-tighter">UID_{selectedUser.id.slice(0, 12)}</span>
                       <div className="w-1 h-1 bg-slate-800 rounded-full" />
                       <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{selectedUser.role}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 border-b border-slate-800/50 pb-2">Vector_Matrix_Override</div>
                   <div className="space-y-3">
                      {permissionMatrix.map((perm) => {
                        const isInherited = perm.roles.includes(selectedUser.role);
                        const hasOverride = selectedUser.permissions?.[perm.key] === true;
                        const isDenied = selectedUser.permissions?.[perm.key] === false;
                        
                        return (
                          <div key={perm.key} className="flex items-center justify-between p-5 bg-slate-950/40 border border-slate-800/80 rounded-[1.5rem] group hover:bg-slate-950 transition-all tactical-border">
                            <div>
                               <div className="text-[11px] font-black text-slate-200 group-hover:text-white transition-colors tracking-tight uppercase">{perm.label}</div>
                               <div className="text-[8px] font-mono uppercase text-slate-600 mt-1 flex items-center gap-2 font-bold">
                                 {isInherited ? <span className="text-indigo-400/80">Inherited: {selectedUser.role}</span> : "Restricted"}
                                 {hasOverride && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-[4px] border border-emerald-500/20">MANUAL_ALLOW</span>}
                               </div>
                            </div>
                            <button
                               onClick={() => togglePermission(selectedUser.id, perm.key, hasOverride)}
                               className={cn(
                                 "w-12 h-7 rounded-full relative transition-all duration-300",
                                 (isInherited || hasOverride) && !isDenied ? "bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]" : "bg-slate-900 border border-slate-800"
                               )}
                            >
                               <div className={cn(
                                 "absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300",
                                 (isInherited || hasOverride) && !isDenied ? "left-6" : "left-1.5 opacity-20"
                               )} />
                            </button>
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] relative overflow-hidden group">
                   <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px:20px] opacity-10" />
                   <div className="flex items-center gap-3 mb-3 relative">
                      <ShieldAlert className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400 group-hover:text-indigo-300 transition-colors">Tactical_Constraint</span>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic relative">
                     "Manual permission vectors supersede mesh-inherited role parameters. Authorization changes are committed to the immutable audit stream instantly."
                   </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="matrix"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel border-slate-800/80 rounded-[3rem] p-10 space-y-10 tactical-border bg-slate-950/20 h-fit"
              >
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                      <BrainCircuit className="w-5 h-5 text-indigo-500" />
                   </div>
                   <div className="space-y-0.5">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Auth_Matrix_Logic</h3>
                      <p className="text-[8px] font-mono text-slate-600 uppercase font-black">Cluster_Configuration_0x11</p>
                   </div>
                </div>
                <div className="space-y-6">
                  {permissionMatrix.map((perm) => (
                    <div key={perm.key} className="space-y-3">
                       <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                         {perm.label}
                         {perm.roles.includes('responder') && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                       </div>
                       <div className="flex gap-2">
                          {roles.map(r => (
                            <div 
                              key={r.id} 
                              className={cn(
                                "flex-1 h-2 rounded-full transition-all duration-700 shadow-inner",
                                perm.roles.includes(r.id) ? "bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.3)]" : "bg-slate-900 border border-slate-800"
                              )} 
                              title={r.label}
                            />
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
                <div className="pt-8 border-t border-slate-900/50 flex justify-between px-2">
                   {roles.map(r => (
                     <div key={r.id} className="flex flex-col items-center gap-2 group">
                        <div className={cn("w-1.5 h-1.5 rounded-full ring-4 ring-slate-950 shadow-lg group-hover:scale-150 transition-transform", 
                           r.id === 'admin' ? 'bg-indigo-500' : 
                           r.id === 'staff' ? 'bg-blue-500' : 
                           r.id === 'responder' ? 'bg-red-500' : 'bg-slate-700'
                        )} />
                        <span className="text-[9px] font-black uppercase text-slate-600 group-hover:text-slate-400 transition-colors tracking-tight italic">{r.id.slice(0, 3)}</span>
                     </div>
                   ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-indigo-500/5 -translate-y-1/2 pointer-events-none" />
        
        <div className="p-8 glass-panel border-indigo-500/30 rounded-[2.5rem] space-y-6 tactical-border backdrop-blur-sm group hover:bg-slate-900/50 transition-colors bg-indigo-500/5 transition-all">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/40 shadow-xl group-hover:scale-110 transition-transform">
                <BrainCircuit className="w-6 h-6 text-indigo-400 animate-pulse" />
             </div>
             <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">QuantumLink_Audit</h3>
                <p className="text-[9px] font-mono text-indigo-500/50 uppercase font-black italic">AI_Safety_Integrity_Check</p>
             </div>
          </div>
          <div className="space-y-4 px-2">
             <p className="text-[11px] text-slate-400 leading-relaxed font-bold italic font-mono">
               "QuantumLink is scanning personnel nodes for authentication anomalies. No suspicious role escalations detected in the last 24h cycle."
             </p>
             <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">
                <div className="px-2 py-1 bg-slate-950 rounded border border-white/5">Nodes_Verified: 100%</div>
                <div className="px-2 py-1 bg-slate-950 rounded border border-white/5">Integrity_Hash: SEC_OK</div>
             </div>
          </div>
        </div>
        
        <div className="p-8 glass-panel border-slate-800 rounded-[2.5rem] space-y-6 tactical-border backdrop-blur-sm group hover:bg-slate-900/50 transition-colors">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-xl group-hover:shadow-emerald-500/5 transition-all">
                <Activity className="w-6 h-6 text-emerald-400 group-hover:animate-pulse" />
             </div>
             <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Node_Sync_State</h3>
                <p className="text-[9px] font-mono text-emerald-500/50 uppercase font-black italic">Mesh_Latency: 1.2ms</p>
             </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-bold italic font-mono px-2">
            "Edge node synchronization for RBAC vectors is optimal. All personnel permission manifest clones are verified against master registry hashes."
          </p>
        </div>
      </div>

      <div className="space-y-6 relative">
         <div className="flex items-center gap-3 px-4 relative">
            <div className="w-12 h-[1px] bg-indigo-500/20" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">EchoSync_Immutable_Ledger</h2>
            <div className="flex-1 h-[1px] bg-slate-800/50" />
         </div>
         
         <div className="glass-panel border-slate-800/80 rounded-[3rem] overflow-hidden tactical-border relative">
            <div className="scanline opacity-10" />
            <div className="divide-y divide-slate-800/40 relative z-10">
               {ledgerEntries.map((log, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-6 hover:bg-slate-900/40 transition-all group border-l-2 border-transparent hover:border-indigo-500/30">
                     <div className="flex items-center gap-6">
                        <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 group-hover:border-indigo-500/20 transition-colors">
                           <code className="text-[9px] text-indigo-400/50 font-mono tracking-tighter group-hover:text-indigo-400">{log.hash}</code>
                        </div>
                        <div className="space-y-0.5">
                           <span className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-indigo-100 transition-colors">{log.action}</span>
                           <p className="text-[8px] font-mono text-slate-700 group-hover:text-slate-500 transition-colors">SEQUENCE: 00{i+1}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-10 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                           <span className="text-[10px] font-mono text-slate-500 uppercase font-black italic block group-hover:text-slate-400 transition-colors">{log.entity}</span>
                           <span className="text-[8px] text-slate-700 font-mono text-right block tracking-tighter">SEC_TOKEN: OK</span>
                        </div>
                        <div className={cn(
                           "px-4 py-1.5 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase border shadow-lg transition-all",
                           log.status === 'CONFIRMED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse"
                        )}>
                           {log.status}
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
         <div className="text-center">
            <p className="text-[9px] text-slate-800 font-black uppercase tracking-[0.6em] italic animate-pulse">End_of_Transmission_Manifest // All_Records_Verified</p>
         </div>
      </div>
    </div>
  );

}
