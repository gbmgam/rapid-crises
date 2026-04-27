import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, Plus, Trash2, ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';

export default function EmergencyContacts() {
  const { emergencyContacts, addContact, removeContact, updateContact } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', notifyOnAlert: true });
  const [success, setSuccess] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    TacticalAudio.playConfirm();
    await addContact(newContact);
    setNewContact({ name: '', phone: '', email: '', notifyOnAlert: true });
    setIsAdding(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Emergency Contacts</h3>
          <p className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Authorized guardians for automated alerting.</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); TacticalAudio.playBlip(1200, 0.05); }}
          className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Contact Node Synchronized</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {emergencyContacts.length === 0 && !isAdding ? (
          <div className="p-8 border-2 border-dashed border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-slate-700" />
             </div>
             <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em] max-w-[200px]">No authorized guardians registered. System redundancy at 0%.</p>
          </div>
        ) : (
          emergencyContacts.map((contact, idx) => (
            <motion.div 
              key={contact.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 glass-panel rounded-[2rem] border border-white/5 bg-slate-900/40 space-y-4 relative group"
            >
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                        <User className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">{contact.name}</h4>
                        <p className="text-[9px] font-mono text-slate-500 uppercase">{contact.phone || contact.email}</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => { removeContact(contact.id); TacticalAudio.playAlert(); }}
                    className="p-2 text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
               </div>

               <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                     <ShieldCheck className={cn("w-3.5 h-3.5", contact.notifyOnAlert ? "text-emerald-500" : "text-slate-700")} />
                     <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Auto_Notify_On_SOS</span>
                  </div>
                  <button 
                    onClick={() => updateContact(contact.id, { notifyOnAlert: !contact.notifyOnAlert })}
                    className={cn(
                      "w-10 h-5 rounded-full p-1 transition-colors relative",
                      contact.notifyOnAlert ? "bg-emerald-600" : "bg-slate-800"
                    )}
                  >
                    <div className={cn(
                      "w-3 h-3 bg-white rounded-full transition-all",
                      contact.notifyOnAlert ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
               </div>
            </motion.div>
          ))
        )}
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
        >
          <div className="w-full max-w-sm glass-panel p-8 rounded-[3rem] border border-white/10 bg-slate-900 relative shadow-2xl">
            <button 
              onClick={() => setIsAdding(false)}
              className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div className="text-center space-y-2">
                <User Plus className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Deploy Guardian</h3>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Registering new emergency node</p>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 ml-1">Guardian_Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      value={newContact.name}
                      onChange={(e) => setNewContact({...newContact, name: e.target.value.toUpperCase()})}
                      placeholder="NAME_OF_RESPONDER"
                      className="w-full bg-slate-800 border-none rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 uppercase"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-500 ml-1">Phone_Link</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                        type="tel" 
                        value={newContact.phone}
                        onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                        placeholder="+1-555-MESH-OPS"
                        className="w-full bg-slate-800 border-none rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-500 ml-1">Email_Link</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                        type="email" 
                        value={newContact.email}
                        onChange={(e) => setNewContact({...newContact, email: e.target.value.toUpperCase()})}
                        placeholder="EMAIL@G_PROTOCOL.NET"
                        className="w-full bg-slate-800 border-none rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Sync Guardian Node
                  </button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
