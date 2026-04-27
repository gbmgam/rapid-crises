import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX, Terminal, Brain, Zap, Command, X, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotify } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useTactical } from '../contexts/TacticalContext';
import { navBus } from '../lib/navBus';
import { TacticalAudio } from '../lib/audio';

interface VoiceAssistantProps {
  onCommand: (command: string) => void;
  activeTab: string;
}

export default function VoiceAssistant({ onCommand, activeTab }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [showHud, setShowHud] = useState(false);
  const [alwaysListening, setAlwaysListening] = useState(false);
  const { notify } = useNotify();
  const { triggerEmergency, activeIncidentId, privacyConsent, resolveIncident } = useTactical();
  const recognitionRef = useRef<any>(null);
  const hotwordRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.8; // Deep tactical voice
    utterance.rate = 1.1;
    utterance.volume = 1;
    
    // Attempt to find a robotic or deep voice
    const voices = window.speechSynthesis.getVoices();
    const tacticalVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Robot') || v.name.includes('Male')) || voices[0];
    if (tacticalVoice) utterance.voice = tacticalVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
    setLastResponse(text);
  }, []);

  const { profile } = useAuth();

  const canAccess = useCallback((tabId: string) => {
    const role = profile?.role;
    if (tabId === 'sos' || tabId === 'map' || tabId === 'settings' || tabId === 'privacy') return true;
    if (tabId === 'dashboard') return role === 'staff' || role === 'admin';
    if (tabId === 'admin') return role === 'admin';
    return false;
  }, [profile]);

  const processCommand = useCallback((rawText: string) => {
    const lowerText = rawText.toLowerCase().trim();
    setTranscript(lowerText);
    
    // 1. Emotional State Detection
    const emotionalState = {
      panic: ['scared', 'afraid', 'panicking', 'don\'t know what to do', 'help me', 'oh my god', 'please', 'hurry'],
      confusion: ['lost', 'where am i', 'confused', 'don\'t understand', 'what is happening'],
      aggravation: ['useless', 'stupid', 'fix it', 'not working', 'wrong', 'hate'],
      relief: ['safe', 'thank god', 'better', 'okay now', 'finally'],
    };

    const isPanicked = emotionalState.panic.some(word => lowerText.includes(word));
    const isConfused = emotionalState.confusion.some(word => lowerText.includes(word));
    const isAggravated = emotionalState.aggravation.some(word => lowerText.includes(word));
    const isRelieved = emotionalState.relief.some(word => lowerText.includes(word));
    const isThankful = lowerText.includes('thank you') || lowerText.includes('thanks');
    const isNegation = lowerText.includes('no') || lowerText.includes('stop') || lowerText.includes('cancel') || lowerText.includes('wrong') || lowerText.includes('don\'t');

    // 2. Emergency Keyword Detection (Auto-Trigger) - Hardwired for safety
    const distressKeywords = ['help', 'sos', 'fire', 'attack', 'unsafe', 'police', 'medic', 'emergency', 'danger', 'shooter', 'bomb', 'medical'];
    // Filter out thankful contexts AND negation contexts to avoid false triggers
    const isDistress = !isThankful && !isNegation && (distressKeywords.some(word => lowerText.includes(word)) || isPanicked);

    // Crisis Resolution Commands
    if ((lowerText.includes('cancel alert') || lowerText.includes('all clear')) && activeIncidentId) {
      TacticalAudio.playConfirm();
      speak("Acknowledged. Situation secure. Resolving active emergency incident and notifying ground teams.");
      resolveIncident(activeIncidentId);
      return;
    }

    if (isNegation && activeIncidentId) {
      speak("Acknowledged. Cancel request detected. Say 'cancel alert' or 'all clear' to confirm you are safe.");
      return;
    }

    if (isDistress) {
      if (!activeIncidentId) {
        TacticalAudio.playAlert();
        if (isPanicked) {
          speak("I can hear that you're stressed. Deep breaths. I've initiated an emergency uplink and help is on the way. I'm staying right here with you.");
        } else {
          speak("Crisis signature detected. Initiating emergency uplink and notifying nearby responders. Stay calm.");
        }
        triggerEmergency(isPanicked ? 'panic' : 'distress', `Voice Trigger: "${rawText}"`);
        onCommand('sos');
      } else {
        TacticalAudio.playConfirm();
        if (isPanicked) {
          speak("Help is coming. I am tracking your location. Focus on my voice and follow the path on your screen.");
        } else {
          speak("Emergency protocol is already active. I am tracking your position and prioritizing your safety.");
        }
        if (activeTab !== 'sos') onCommand('sos');
      }
      return; 
    }

    // 3. Empathetic Navigation Responses
    if (isConfused) {
      TacticalAudio.playConfirm();
      speak("It's completely normal to feel disoriented in this situation. I'll guide you step-by-step. Focus on the map on your screen.");
      if (activeTab !== 'map') onCommand('map');
      return;
    }

    if (isAggravated) {
      speak("I apologize if my interface is causing frustration. I am recalibrating to better serve your needs. Please tell me exactly what you see.");
      return;
    }

    if (isRelieved) {
      speak("Confirmed. I am glad you are feeling more secure. I will continue to monitor the perimeter for any changes.");
      return;
    }

    // 4. Voice Feedback / Control
    if (lowerText.includes('stop talking') || lowerText.includes('quiet') || lowerText.includes('shut up') || lowerText.includes('shh')) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (lowerText.includes('louder') || lowerText.includes('increase volume')) {
      speak("Adjusting audio gain to maximum. Can you hear me clearly now?");
      return;
    }

    if (lowerText.includes('stealth mode') || lowerText.includes('go dark') || lowerText.includes('privacy mode')) {
      speak("Activating stealth protocols. Background telemetry is now suppressed. Your mesh footprint is being masked.");
      onCommand('privacy');
      return;
    }

    // Global Navigation Commands
    if (lowerText.includes('map') || lowerText.includes('venue')) {
      if (canAccess('map')) {
        TacticalAudio.playConfirm();
        speak("Switching to Venue Map. Initializing spatial anchors.");
        onCommand('map');
      } else {
        speak("Access restricted. Insufficient clearance for spatial mapping.");
      }
    } else if (lowerText.includes('sos') || lowerText.includes('emergency') || lowerText.includes('alert')) {
      if (canAccess('sos')) {
        TacticalAudio.playError();
        speak("Emergency protocol active. Navigating to SOS command center.");
        onCommand('sos');
      } else {
        speak("Access restricted.");
      }
    } else if (lowerText.includes('dashboard') || lowerText.includes('status')) {
      if (canAccess('dashboard')) {
        TacticalAudio.playConfirm();
        speak("Accessing system dashboard. Querying mesh nodes.");
        onCommand('dashboard');
      } else {
        speak("Access restricted. Staff clearance required for tactical dashboard.");
      }
    } else if (lowerText.includes('admin') || lowerText.includes('control')) {
      if (canAccess('admin')) {
        TacticalAudio.playConfirm();
        speak("Personnel control interface requested. Verifying clearance.");
        onCommand('admin');
      } else {
        speak("Access denied. Admin authorization required.");
      }
    } 
    // Venue Map Specific Logic (simulated transition + voice context)
    else if (activeTab === 'map' && (lowerText.includes('lobby') || lowerText.includes('junction'))) {
      TacticalAudio.playConfirm();
      speak("Highlighting Main Lobby. Optimal route calculated.");
      navBus.emit('lobby');
    } else if (activeTab === 'map' && (lowerText.includes('exit') || lowerText.includes('escape'))) {
      TacticalAudio.playConfirm();
      speak("Identifying nearest Fire Exit. Pathfinding engaged.");
      navBus.emit('exit');
    } else if (activeTab === 'map' && (lowerText.includes('security') || lowerText.includes('responder'))) {
      TacticalAudio.playConfirm();
      speak("Locating Tactical Responder Node Alpha.");
      navBus.emit('security_a');
    } else if (activeTab === 'map' && (lowerText.includes('medical') || lowerText.includes('first aid'))) {
      TacticalAudio.playConfirm();
      speak("Locating Medical Station.");
      navBus.emit('medical');
    } else if (activeTab === 'map' && (lowerText.includes('reset') || lowerText.includes('clear'))) {
      TacticalAudio.playConfirm();
      speak("Clearing active navigation paths.");
      navBus.emit('reset');
    }
    // Persona Commands
    else if (lowerText.includes('who are you') || lowerText.includes('identity')) {
      speak("I am Quantum Link A.I. Your tactical mesh navigator and crisis response assistant. My current priority is your absolute safety.");
    } else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
      speak("Quantum Link system online. Ready for command. I'm here to help you navigate and stay safe. How are you feeling right now?");
    } else if (lowerText.includes('good') || lowerText.includes('great') || lowerText.includes('nice job') || lowerText.includes('well done')) {
      speak("Acknowledged. Optimizing my response patterns based on your positive feedback. I am dedicated to excellence in your protection.");
    } else if (isThankful) {
      speak("Happy to help you.");
    } else {
      if (activeIncidentId) {
        speak("Command not recognized. Please stay calm and follow the illuminated path to safety. Responders are inbound. I'm right here with you.");
      } else {
        speak("I didn't quite catch that. I can help with navigation, system status, or emergency alerts. Please repeat your tactical directive.");
      }
    }

    // Auto-hide transcript after 3s
    setTimeout(() => setTranscript(''), 3000);
  }, [onCommand, speak, canAccess, activeTab]);

  // Hotword Detection Logic (SIMULATED / WEB SPEECH API)
  useEffect(() => {
    if (!alwaysListening || !privacyConsent) {
      hotwordRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const hotwordRecognition = new SpeechRecognition();
    hotwordRecognition.continuous = true;
    hotwordRecognition.interimResults = false;
    hotwordRecognition.lang = 'en-US';

    hotwordRecognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.toLowerCase();
      
      if (text.includes('hey guardian') || text.includes('guardian help')) {
        TacticalAudio.playBlip(1200, 0.1);
        speak("Guardian AI listening. State your emergency or request.");
        toggleListening();
      }
    };

    hotwordRecognition.onerror = () => {
      // Silently restart on common errors
      setTimeout(() => {
        if (alwaysListening) hotwordRecognition.start();
      }, 1000);
    };

    hotwordRecognition.onend = () => {
      if (alwaysListening) hotwordRecognition.start();
    };

    hotwordRef.current = hotwordRecognition;
    try {
      hotwordRecognition.start();
    } catch(e) {}

    return () => hotwordRecognition.stop();
  }, [alwaysListening, privacyConsent, speak]);

  const toggleListening = () => {
    TacticalAudio.playBlip(1000, 0.05);
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        notify("Voice recognition not supported.", "error");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setShowHud(true);
      };

      recognition.onresult = (event: any) => {
        const currentTranscript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTranscript(currentTranscript);
        
        if (event.results[0].isFinal) {
          processCommand(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'no-speech') {
          setTranscript('No speech detected...');
          setTimeout(() => setTranscript(''), 2000);
        } else if (event.error === 'not-allowed') {
          notify("Microphone restricted. Open in new tab to enable voice control.", "info");
        } else if (event.error !== 'aborted') {
          console.error('Speech Recognition Error:', event.error);
          notify("Voice System Error: " + event.error, "error");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  return (
    <>
      {/* Floating Activation Button */}
      <div className="fixed bottom-12 right-6 z-[100] flex flex-col items-center gap-4">
        <AnimatePresence>
          {showHud && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel border-indigo-500/30 p-6 rounded-[2rem] tactical-border w-64 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={cn(
                     "w-2 h-2 rounded-full",
                     isListening ? "bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" : "bg-indigo-500"
                   )} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                     {isListening ? "Listening..." : "Awaiting Info"}
                   </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAlwaysListening(!alwaysListening)}
                    className={cn(
                      "p-1.5 rounded-lg border transition-colors",
                      alwaysListening ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                    )}
                    title="Always Listening (Hey Guardian)"
                  >
                    <Activity className="w-3 h-3" />
                  </button>
                  <button onClick={() => setShowHud(false)}>
                    <X className="w-3 h-3 text-slate-600 hover:text-white" />
                  </button>
                </div>
              </div>

              <div className="min-h-[40px] border-l-2 border-indigo-500/20 pl-4">
                 {transcript ? (
                   <p className="text-sm font-black text-white italic tracking-tight leading-snug">
                     "{transcript}"
                   </p>
                 ) : (
                   <p className="text-[10px] font-mono text-slate-500 uppercase italic">
                     Say "Navigate to Map" or "System Status"
                   </p>
                 )}
              </div>

              {lastResponse && (
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex gap-3 items-start">
                   <Volume2 className={cn("w-4 h-4 shrink-0 mt-0.5", isSpeaking ? "text-indigo-400 animate-pulse" : "text-slate-600")} />
                   <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase italic">
                     {lastResponse}
                   </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            setShowHud(true);
            toggleListening();
          }}
          className={cn(
            "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 border-2 relative group overflow-hidden",
            isListening 
              ? "bg-red-600 border-red-400 shadow-[0_0_30px_#ef444450]" 
              : "bg-slate-900 border-slate-800 hover:border-indigo-500 shadow-2xl"
          )}
        >
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.div
                key="listening"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <MicOff className="w-8 h-8 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Mic className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Audio Visualizer Minimalist */}
          {isListening && (
            <div className="absolute bottom-2 flex items-center gap-0.5">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  className="w-1 bg-white/40 rounded-full"
                />
              ))}
            </div>
          )}
        </button>
      </div>

      {/* Full-Screen HUD Overlay When Speaking */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center bg-indigo-950/10 backdrop-blur-[2px]"
          >
            <div className="w-full h-full border-[40px] border-indigo-500/5 animate-pulse" />
            <div className="absolute bottom-32 flex flex-col items-center gap-2">
               <div className="flex gap-1">
                 {[...Array(24)].map((_, i) => (
                   <motion.div
                     key={i}
                     animate={{ height: [2, Math.random() * 20 + 5, 2] }}
                     transition={{ duration: 0.2, repeat: Infinity }}
                     className="w-1 bg-indigo-500/40 rounded-full shadow-[0_0_8px_#6366f1]"
                   />
                 ))}
               </div>
               <span className="text-[10px] font-black uppercase tracking-[1em] text-indigo-400 animate-pulse ml-4">
                 VOICE_NAV_FEEDBACK
               </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
