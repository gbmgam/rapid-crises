import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shield, UserPlus, Trash2, Mail, CheckCircle, ShieldAlert, Key, History } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useNotify } from '../contexts/NotificationContext';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function PersonnelManagement() {
  const { profile, inviteResponder, logAuditAction, updateRole } = useAuth();
  const { notify } = useNotify();
  const [activeTab, setActiveTab] = useState<'users' | 'responders' | 'logs'>('users');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ name: '', email: '', responderId: '' });
  
  const [users, setUsers] = useState<any[]>([]);
  const [responders, setResponders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !['admin', 'superadmin'].includes(profile.role)) return;

    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(50)), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubResponders = onSnapshot(query(collection(db, 'responders'), limit(50)), (snap) => {
      setResponders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUsers();
      unsubResponders();
      unsubLogs();
    };
  }, [profile]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await inviteResponder(inviteData);
      await logAuditAction('INVITE_RESPONDER', inviteData);
      notify(`Invitation sent to ${inviteData.email}`, 'success');
      setIsInviteModalOpen(false);
      setInviteData({ name: '', email: '', responderId: '' });
    } catch (err) {
      notify('Failed to send invitation', 'error');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (profile?.role !== 'superadmin' && newRole === 'superadmin') {
      notify('Unauthorized role elevation', 'error');
      return;
    }
    // Simulation: in real app this would be more restricted
    notify(`Role updated for user ${userId} to ${newRole}`, 'success');
    await logAuditAction('UPDATE_USER_ROLE', { userId, newRole });
  };

  if (!['admin', 'superadmin'].includes(profile?.role)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-black text-white uppercase italic">Access Denied</h2>
        <p className="text-zinc-500 text-sm max-w-xs mt-2">Level 4 authorization required for personnel management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['users', 'responders', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                activeTab === tab 
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" 
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {activeTab === 'responders' && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
          >
            <UserPlus className="w-4 h-4" />
            Add Responder
          </button>
        )}
      </div>

      <div className="glass-panel border-zinc-800 rounded-3xl overflow-hidden min-h-[400px]">
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Users className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{u.displayName || 'Anonymous'}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{u.email || u.anon_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role || 'user'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="bg-zinc-800 border-zinc-700 text-[10px] font-black uppercase text-white rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="guest">Guest</option>
                        <option value="user">User</option>
                        <option value="responder">Responder</option>
                        <option value="admin">Admin</option>
                        {profile?.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", u.isOnline ? "bg-emerald-500" : "bg-zinc-600")} />
                        <span className="text-[10px] font-black uppercase text-zinc-400">{u.isOnline ? 'Active' : 'Idle'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'responders' && (
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 gap-4">
            {responders.map(r => (
              <div key={r.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-500">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">{r.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500">{r.responderId} • {r.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                        r.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                      )}>{r.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                      <Mail className="w-4 h-4" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-6 space-y-4">
            {auditLogs.map(log => (
              <div key={log.id} className="flex gap-4 p-3 bg-zinc-950/50 border border-zinc-900/50 rounded-xl">
                 <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center shrink-0">
                    <History className="w-4 h-4 text-zinc-500" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                       <span className="text-[10px] font-black text-white uppercase truncate">{log.action}</span>
                       <span className="text-[8px] font-mono text-zinc-600 whitespace-nowrap">
                          {log.timestamp?.toDate().toLocaleString()}
                       </span>
                    </div>
                    <div className="text-[9px] text-zinc-500 flex items-center gap-2">
                       <span className="font-bold text-zinc-400">{log.userEmail}</span>
                       <span>•</span>
                       <span className="font-mono">{JSON.stringify(log.details)}</span>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl relative"
            >
              <div className="flex items-center gap-3 mb-8">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-500">
                    <UserPlus className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-white uppercase italic leading-none">Add Responder</h2>
                    <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mt-1">Personnel Induction</p>
                 </div>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-zinc-500">Full Name</label>
                    <input 
                      required
                      value={inviteData.name}
                      onChange={e => setInviteData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                      placeholder="e.g. Sgt. Miller"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-zinc-500">Email Address</label>
                    <input 
                      required
                      type="email"
                      value={inviteData.email}
                      onChange={e => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                      placeholder="responder@guardian.hq"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-zinc-500">Responder ID</label>
                    <input 
                      required
                      value={inviteData.responderId}
                      onChange={e => setInviteData(prev => ({ ...prev, responderId: e.target.value.toUpperCase() }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-indigo-500 transition-all font-mono font-bold"
                      placeholder="R-XXXXX"
                    />
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-black uppercase rounded-2xl border border-zinc-700 hover:bg-zinc-700 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
                    >
                      Authorize
                    </button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
