/**
 * QuantumLink Voice Intelligence Service
 * Simulation of TF Lite keyword spotting using Web Speech API for real sensor interaction.
 */

import { TacticalAudio } from '../lib/audio';

type CommandCallback = (command: string) => void;

class VoiceIntelligenceService {
  private recognition: any = null;
  private isListening: boolean = false;
  private callbacks: Set<CommandCallback> = new Set();
  
  constructor() {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).WebkitSpeechRecognition || (window as any).speechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('')
          .toLowerCase();

        console.log('Voice Stream:', transcript);

        if (
          transcript.includes('guardian') || 
          transcript.includes('help') || 
          transcript.includes('emergency') || 
          transcript.includes('guardian test')
        ) {
          this.triggerMatch(transcript);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Voice Intelligence Error:', event.error);
        if (event.error === 'not-allowed') {
          this.isListening = false;
        }
      };
      
      this.recognition.onend = () => {
        if (this.isListening) {
          this.recognition.start();
        }
      };
    }
  }

  public subscribe(cb: CommandCallback) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private triggerMatch(phrase: string) {
    this.callbacks.forEach(cb => cb(phrase));
    TacticalAudio.playBlip(2000, 0.1);
  }

  public start() {
    if (!this.recognition || this.isListening) return;
    try {
      this.isListening = true;
      this.recognition.start();
      console.log('Voice Intelligence Active: Listening for keyword "Guardian"...');
    } catch (e) {
      console.error('Failed to start voice recognition:', e);
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  public speak(text: string) {
    if (typeof window === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.9; // Tactical voice
    window.speechSynthesis.speak(utterance);
  }
}

export const VoiceIntelligence = new VoiceIntelligenceService();
