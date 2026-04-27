import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Mail, Lock, User, UserPlus, Globe, LogIn, ChevronRight, Activity, Key, Loader2, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { TacticalAudio } from '../lib/audio';

type AuthMode = 'login' | 'register' | 'special' | 'guest';

export default function AuthUI() {
  const { login, register, responderLogin, adminLogin, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [responderId, setResponderId] = useState('');
  const [totp, setTotp] = useState('');
  const [specialRole, setSpecialRole] = useState<'responder' | 'admin'>('responder');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    TacticalAudio.playBlip(1500, 0.05);

    try {
      if (mode === 'login') {
        await login('google', email, password);
      } else if (mode === 'register') {
        await register(email, password, displayName);
      } else if (mode === 'guest') {
        await login('guest');
      } else if (mode === 'special') {
        if (specialRole === 'responder') {
          await responderLogin(responderId, password);
        } else {
          await adminLogin(email, password, totp);
        }
      }
      TacticalAudio.playConfirm();
    } catch (err: any) {
      setError(err.message || "Authorization failure. Link severed.");
      TacticalAudio.playAlert();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login('google');
      TacticalAudio.playConfirm();
    } catch (err: any) {
      setError(err.message);
      TacticalAudio.playAlert();
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("IDENTIFIER_MISSING: Enter email for reset protocol.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setError("SUCCESS: Reset uplink dispatched to target email.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* HUD Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:48px_48px] opacity-20" />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] border border-indigo-500/10 rounded-full pointer-events-none"
      />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-[1.5rem] flex items-center justify-center mb-6 mx-auto shadow-2xl relative"
          >
            <Shield className="w-10 h-10 text-indigo-500" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center border-2 border-slate-950">
              <Activity className="w-3 h-3 text-white animate-pulse" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
            Quantum<span className="text-indigo-500">Link</span>
          </h1>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.4em]">
            Auth Protocol Initialized // v2.4
          </p>
        </div>

        <div className="glass-panel p-1 rounded-2xl border border-white/5 bg-slate-900/50 mb-6 flex">
           {(['login', 'register', 'guest', 'special'] as const).map((m) => (
             <button
               key={m}
               onClick={() => { setMode(m); setError(null); TacticalAudio.playBlip(1200, 0.02); }}
               className={cn(
                 "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                 mode === m ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
               )}
             >
               {m}
             </button>
           ))}
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
          onSubmit={handleSubmit}
        >
          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.div 
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Secure_Identifiers</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      placeholder="EMAIL@PROTOCOL.NET"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors uppercase"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="password" 
                      placeholder="ENTROPY_PASS_KEY"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'register' && (
              <motion.div 
                key="register"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">New_Node_Registration</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="DISPLAY_ALIAS"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors uppercase"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      placeholder="EMAIL@PROTOCOL.NET"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors uppercase"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="password" 
                      placeholder="PASS_SEED_PHRASE"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'special' && (
              <motion.div 
                key="special"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex gap-2 mb-4">
                  {(['responder', 'admin'] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSpecialRole(role)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                        specialRole === role ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-slate-800 text-slate-600"
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                {specialRole === 'responder' ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Responder_Credentials</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="RESPONDER_ID_7F"
                          value={responderId}
                          onChange={(e) => setResponderId(e.target.value.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors uppercase"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="password" 
                          placeholder="CMD_KEY_PASS"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                     <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Admin_Elevated_Access</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="email" 
                          placeholder="ADMIN@COMMAND.ROOT"
                          value={email}
                          onChange={(e) => setEmail(e.target.value.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors uppercase"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="password" 
                          placeholder="ROOT_PASS_KEY"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="relative">
                        <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="MFA_TOTP_CODE"
                          value={totp}
                          onChange={(e) => setTotp(e.target.value)}
                          disabled={loading}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-white placeholder:text-slate-700 focus:border-indigo-500 transition-colors"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {mode === 'guest' && (
              <motion.div 
                key="guest"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 text-center py-6"
              >
                <div className="relative w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
                   <Globe className="w-10 h-10 text-indigo-400" />
                   <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping opacity-20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Temporal Node Access</h3>
                  <p className="text-slate-500 text-[10px] uppercase leading-relaxed font-mono">Anonymous uplink provided for immediate safety. No cloud persistence will be active.</p>
                </div>
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3 text-left">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[9px] text-amber-400/80 uppercase font-mono leading-tight">Limited functionality: Settings & contacts will not sync across hardware.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-mono text-red-500 uppercase tracking-widest text-center"
            >
              Error: {error}
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {mode === 'login' ? 'Establish Link' : mode === 'register' ? 'Register Node' : mode === 'special' ? 'Request Auth' : 'Initialize Guest'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          {(mode === 'login' || mode === 'register') && (
            <div className="relative py-4">
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
              <span className="relative z-10 bg-slate-950 px-4 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mx-auto block w-fit">External_SSO</span>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <button
              onClick={handleGoogleLogin}
              type="button"
              disabled={loading}
              className="w-full py-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Auth with Google Control
            </button>
          )}

          {mode === 'login' && (
            <button 
              type="button" 
              onClick={handleResetPassword}
              className="w-full text-center text-[8px] font-black uppercase text-slate-600 hover:text-indigo-400 underline tracking-widest mt-4"
            >
              Request_Entropy_Reset (Forgot Password)
            </button>
          )}
        </motion.form>

        <div className="mt-12 flex justify-center gap-2 opacity-20 hover:opacity-100 transition-opacity">
          <Shield className="w-3 h-3 text-slate-500" />
          <span className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">QuantumLink Secure Protocol v2.4</span>
        </div>
      </div>
    </div>
  );
}
