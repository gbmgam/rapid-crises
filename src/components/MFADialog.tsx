import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Key, X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';

interface MFADialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: () => void;
  actionName: string;
}

export default function MFADialog({ isOpen, onClose, onVerify, actionName }: MFADialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(false);
    
    // Simulation: Mock MFA verification
    setTimeout(() => {
      if (code === '123456') { // Mock passcode
        TacticalAudio.playConfirm();
        onVerify();
        onClose();
        setCode('');
      } else {
        TacticalAudio.playAlert();
        setError(true);
        setIsVerifying(false);
      }
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 backdrop-blur-xl bg-black/80">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            
            <button onClick={onClose} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4 mb-8">
               <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto">
                  <ShieldCheck className="w-8 h-8" />
               </div>
               <div>
                  <h2 className="text-lg font-black text-white uppercase italic tracking-tight">Critical Verification</h2>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Action: {actionName}</p>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">MFA Protocol Code</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input 
                      autoFocus
                      required
                      type="password"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="••••••"
                      className={cn(
                        "w-full bg-zinc-900 border rounded-2xl pl-12 pr-6 py-4 text-white text-lg font-black tracking-[0.5em] outline-none transition-all",
                        error ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "border-zinc-800 focus:border-indigo-500"
                      )}
                    />
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Invalid Protocol Sequence
                    </motion.p>
                  )}
               </div>

               <button 
                 disabled={isVerifying}
                 className={cn(
                   "w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl",
                   isVerifying ? "bg-zinc-800 text-zinc-600" : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20"
                 )}
               >
                 {isVerifying ? 'Verifying...' : 'Authorize Action'}
               </button>

               <p className="text-[8px] text-zinc-600 font-mono text-center uppercase">
                  Authentication session expires in 15 minutes.
               </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
