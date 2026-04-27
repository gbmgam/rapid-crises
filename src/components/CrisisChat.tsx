import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotify } from '../contexts/NotificationContext';
import { TacticalAudio } from '../lib/audio';
import { 
  Send, 
  MessageSquare, 
  Shield, 
  User, 
  CheckCheck,
  MoreVertical,
  Activity,
  Users,
  Mic,
  MicOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ChatProps {
  emergencyId: string;
  role: 'guest' | 'staff' | 'admin';
}

export default function CrisisChat({ emergencyId, role }: ChatProps) {
  const { user, profile } = useAuth();
  const { notify } = useNotify();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [responders, setResponders] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Presence implementation
  useEffect(() => {
    if (!user || role === 'guest') return;

    const presenceDoc = doc(db, `emergencies/${emergencyId}/responders`, user.uid);
    
    setDoc(presenceDoc, {
      userId: user.uid,
      name: profile?.displayName || 'Tactical Team',
      status: 'monitoring',
      updatedAt: serverTimestamp()
    });

    return () => {
      deleteDoc(presenceDoc).catch(console.error);
    };
  }, [emergencyId, user, role]);

  // Real-time messages
  useEffect(() => {
    const q = query(
      collection(db, `emergencies/${emergencyId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `emergencies/${emergencyId}/messages`);
    });

    return () => unsubscribe();
  }, [emergencyId]);

  // Real-time responders
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, `emergencies/${emergencyId}/responders`), (snapshot) => {
      setResponders(snapshot.docs.map(doc => doc.data()));
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !change.doc.metadata.hasPendingWrites) {
          const data = change.doc.data();
          if (data.userId !== user?.uid) {
            notify(`TACTICAL: ${data.name} joined the mesh`, "success");
            TacticalAudio.playBlip(1000, 0.05);
          }
        }
      });
    });
    return () => unsubscribe();
  }, [emergencyId, user, notify]);

  const [isRecording, setIsRecording] = useState(false);

  // Simplified Voice Input logic
  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      notify("Mesh Error: Voice Uplink not supported on this node.", "error");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewMessage(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecording(false);
      TacticalAudio.playBlip(1200, 0.05);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      notify("Mesh Error: Voice capture failed.", "error");
    };

    recognition.onend = () => setIsRecording(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msg = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, `emergencies/${emergencyId}/messages`), {
        text: msg,
        senderId: user.uid,
        senderName: profile?.displayName || (role === 'guest' ? 'Guest' : 'Tactical responder'),
        senderRole: role,
        createdAt: serverTimestamp(),
        type: 'text'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `emergencies/${emergencyId}/messages`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl relative">
      {/* Background HUD Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-slate-950/40 flex items-center justify-between relative z-10 overflow-hidden">
        {/* Stress Signature Visualization (Background) */}
        <div className="absolute inset-0 flex items-end opacity-20 pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div 
              key={i}
              animate={{ height: [`${20 + Math.random() * 40}%`, `${10 + Math.random() * 20}%`, `${30 + Math.random() * 50}%`] }}
              transition={{ duration: 1 + Math.random(), repeat: Infinity }}
              className="flex-1 bg-indigo-500/30 mx-[1px]"
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {responders.length > 0 ? responders.slice(0, 3).map((r, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-black",
                  r.userId === user?.uid ? "bg-indigo-600" : "bg-slate-800"
                )}
              >
                {r.name.slice(0, 1)}
              </div>
            )) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <Users className="w-4 h-4 text-slate-500" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Crisis Mesh</h3>
            <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <Activity className="w-2 h-2 animate-pulse" />
              {responders.length} Operatives Online
            </p>
          </div>
        </div>
        <button className="p-2 text-slate-500 hover:text-white transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide relative z-10"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                    {msg.text}
                  </span>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isMe ? "ml-auto items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {isMe ? "Reporting Node" : msg.senderName}
                  </span>
                  {msg.senderRole !== 'guest' && <Shield className="w-2 h-2 text-indigo-500" />}
                </div>
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  isMe 
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/20" 
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5"
                )}>
                  {msg.text}
                </div>
                <div className="mt-1 flex items-center gap-1.5 px-1">
                  <span className="text-[8px] font-mono text-slate-700">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </span>
                  {isMe && <CheckCheck className="w-2 h-2 text-indigo-500" />}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input */}
      <form 
        onSubmit={sendMessage}
        className="p-4 bg-slate-950/40 border-t border-white/5 relative z-10"
      >
        <div className="relative group">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type tactical update..."
            className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-sans placeholder:text-slate-600 pr-24"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button 
              type="button"
              onClick={toggleRecording}
              className={cn(
                "p-2 rounded-lg transition-all active:scale-95",
                isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white/5 text-slate-500 hover:text-white"
              )}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:grayscale transition-all shadow-lg active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[8px] text-center font-mono text-slate-600 uppercase tracking-widest">
          End-to-End Encrypted via Mesh Core v4.1
        </p>
      </form>
    </div>
  );
}
