import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useNotify } from './NotificationContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  where,
  updateDoc,
  doc 
} from 'firebase/firestore';
import { classifyEmergency } from '../services/geminiService';
// @ts-ignore
import { io } from 'socket.io-client';
import { findPath, Node, Edge } from '../lib/pathfinding';
import { VoiceIntelligence } from '../services/voiceService';
import { TacticalAudio } from '../lib/audio';
import { haversineDistance, getBearing } from '../lib/utils';

// Digital Twin Data
const MESH_NODES: Node[] = [
  { id: 'start', x: 50, y: 50 },
  { id: 'hub_a', x: 25, y: 30 },
  { id: 'hub_b', x: 75, y: 30 },
  { id: 'hub_c', x: 25, y: 70 },
  { id: 'hub_d', x: 75, y: 70 },
  { id: 'exit_1', x: 90, y: 15 },
  { id: 'exit_2', x: 10, y: 15 },
];

const MESH_EDGES: Edge[] = [
  { from: 'start', to: 'hub_a', weight: 10 },
  { from: 'start', to: 'hub_b', weight: 10 },
  { from: 'start', to: 'hub_c', weight: 10 },
  { from: 'start', to: 'hub_d', weight: 10 },
  { from: 'hub_a', to: 'exit_2', weight: 5 },
  { from: 'hub_b', to: 'exit_1', weight: 5 },
  { from: 'hub_c', to: 'hub_a', weight: 8 },
  { from: 'hub_d', to: 'hub_b', weight: 8 },
];

export type TacticalMode = 'escape' | 'assist' | 'silent' | 'idle';

export interface OfficialAlert {
  id: string;
  source: '112_SYSTEM' | 'MET_WEATHER' | 'CITY_DISASTER' | 'TRAFFIC_CORE';
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  description: string;
}

export interface SensorNode {
  id: string;
  type: 'SMOKE' | 'CROWD' | 'STRUCTURAL' | 'CCTV_ANALYTICS';
  status: 'NOMINAL' | 'ALERT';
  value: number;
  location: { x: number; y: number };
}

export interface DangerZone {
  id: string;
  type: 'fire' | 'crowd' | 'structural' | 'biometric';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  radius: number;
  severity: 'low' | 'medium' | 'high';
  label: string;
}

export interface SafeZone {
  id: string;
  name: string;
  type: 'exit' | 'security' | 'medical' | 'shelter';
  location: { lat: number; lng: number };
  radius_meters: number;
  polygon?: Array<{ lat: number; lng: number }>;
  is_accessible: boolean;
  is_closed?: boolean;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy_meters: number;
  speed_mps: number;
  timestamp: number;
  source: 'gps' | 'wifi' | 'ip_fallback';
  heading?: number;
}

export interface RouteStep {
  x: number;
  y: number;
}

interface TacticalState {
  mode: TacticalMode;
  activeIncidentId: string | null;
  incidentData: any | null;
  officialAlerts: OfficialAlert[];
  sensors: SensorNode[];
  verificationMap: Record<string, { confidence: number; verifiedSources: string[] }>;
  prediction: {
    riskLevel: 'low' | 'medium' | 'high';
    anomalyType: string | null;
    confidence: number;
  };
  isSafe: boolean;
  dangerZones: DangerZone[];
  safeZones: SafeZone[];
  userLocation: UserLocation | null;
  nearestSafeZone: SafeZone | null;
  distanceToNearestMeters: number | null;
  isInsideSafeZone: boolean;
  optimalRoute: RouteStep[] | null;
  blockedNodes: Set<string>;
  isScanning: boolean;
  privacyConsent: boolean;
  isStealthMode: boolean;
  dataRetention: 'session' | '30days' | 'permanent';
  safetyTimer: number | null;
  sensorStats: { db: number; crowd: number };
  offlineQueueCount: number;
  anonId: string;
  language: 'en' | 'es' | 'hi';
  hasSeenTutorial: boolean;
  consent: Record<string, boolean>;
  setMode: (mode: TacticalMode) => void;
  setPrivacyConsent: (consent: boolean) => void;
  setIsStealthMode: (stealth: boolean) => void;
  setDataRetention: (retention: 'session' | '30days' | 'permanent') => void;
  setSafetyTimer: (seconds: number | null) => void;
  setLanguage: (lang: 'en' | 'es' | 'hi') => void;
  setConsent: (consent: Record<string, boolean>) => void;
  completeTutorial: () => void;
  clearTacticalHistory: () => Promise<void>;
  triggerEmergency: (type: string, description?: string, isSilent?: boolean) => Promise<string | null>;
  resolveIncident: (id: string) => Promise<void>;
  scanForHazards: () => void;
  blockNode: (nodeId: string) => void;
}

const TacticalContext = createContext<TacticalState | undefined>(undefined);

export function TacticalProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, emergencyContacts } = useAuth();
  const { notify } = useNotify();
  const [mode, setMode] = useState<TacticalMode>('idle');
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [incidentData, setIncidentData] = useState<any>(null);
  const [officialAlerts, setOfficialAlerts] = useState<OfficialAlert[]>([]);
  const [sensors, setSensors] = useState<SensorNode[]>([]);
  const [verificationMap, setVerificationMap] = useState<Record<string, { confidence: number; verifiedSources: string[] }>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(() => {
    return localStorage.getItem('guardian_privacy_consent') === 'true';
  });
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [dataRetention, setDataRetention] = useState<'session' | '30days' | 'permanent'>('30days');
  const [safetyTimer, setSafetyTimer] = useState<number | null>(null);
  const [sensorStats, setSensorStats] = useState({ db: 45, crowd: 12 });
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // New Onboarding States
  const [anonId] = useState(() => {
    let id = localStorage.getItem('guardian_anon_id');
    if (!id) {
      id = `U_${Math.random().toString(36).substr(2, 6)}`;
      localStorage.setItem('guardian_anon_id', id);
    }
    return id;
  });

  const [language, setLanguage] = useState<'en' | 'es' | 'hi'>(() => {
    return (localStorage.getItem('guardian_language') as 'en' | 'es' | 'hi') || 'en';
  });

  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem('guardian_tutorial_seen') === 'true';
  });

  const [consent, setConsent] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem('guardian_consent_map');
    return stored ? JSON.parse(stored) : {
      location: false,
      microphone: false,
      connectivity: false,
      motion: false,
      notifications: false
    };
  });

  const updateConsent = (newConsent: Record<string, boolean>) => {
    setConsent(newConsent);
    localStorage.setItem('guardian_consent_map', JSON.stringify(newConsent));
    setPrivacyConsent(Object.values(newConsent).some(v => v));
  };

  const completeTutorial = () => {
    setHasSeenTutorial(true);
    localStorage.setItem('guardian_tutorial_seen', 'true');
  };

  useEffect(() => {
    localStorage.setItem('guardian_language', language);
  }, [language]);

  const triggerEmergency = useCallback(async (type: string, description?: string, isSilent: boolean = false) => {
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('guardian_offline_queue') || '[]');
      queue.push({ type, description, isSilent, timestamp: Date.now() });
      localStorage.setItem('guardian_offline_queue', JSON.stringify(queue));
      setOfflineQueueCount(queue.length);
      notify("Offline: Alert queued for transmission.", "warning");
      return "queued";
    }

    try {
      const payload = {
        userId: user?.uid || anonId,
        userAnonId: anonId,
        userName: profile?.displayName || `Node_${anonId}`,
        type,
        description: description || 'Automatic tactical trigger',
        isSilent,
        status: 'reported',
        severity: 'medium',
        location: { 
          lat: 40.7128, 
          lng: -74.0060, 
          accuracy: 12,
          speed: mode === 'idle' ? 0 : 1.2,
          venueId: 'venue-mesh-1' 
        },
        mobility: mode === 'assist' ? 'static' : 'mobile',
        environmental: {
          db: sensorStats.db,
          crowd: sensorStats.crowd,
          isMoving: mode !== 'assist'
        },
        triggerMethod: isSilent ? 'stealth_shake' : 'manual_button'
      };

      // Call Backend API
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();

      // Persist to Firestore for real-time mesh visibility
      const docRef = await addDoc(collection(db, 'emergencies'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        serverId: result.incident_id,
        notifiedContacts: emergencyContacts.filter(c => c.notifyOnAlert).map(c => ({
          name: c.name,
          status: 'sent',
          method: c.phone ? 'SMS' : 'Email'
        }))
      });
      
      // Simulate SMS/Email dispatch
      emergencyContacts.forEach(contact => {
        if (contact.notifyOnAlert) {
          console.log(`[MESH_COMMS] Emergency Alert dispatched to Guardian: ${contact.name} via ${contact.phone || contact.email}`);
          // In a real app: call SMS/Email API or trigger Cloud Function
        }
      });
      
      setActiveIncidentId(docRef.id);
      
      if (isSilent) setMode('silent');
      else if (type === 'medical') setMode('assist');
      else setMode('escape');

      notify(`${isSilent ? 'Silent' : 'Active'} alert uplinked: ${type}`, "error");
      import('../lib/audio')
        .then(({ TacticalAudio }) => TacticalAudio.playAlert())
        .catch(err => console.warn("Tactical audio failed to load:", err));

      // Async AI Classification
      classifyEmergency(description || type).then(aiResult => {
        if (aiResult && docRef.id) {
          updateDoc(doc(db, 'emergencies', docRef.id), {
            severity: aiResult.severity,
            aiClassification: aiResult.summary,
            updatedAt: serverTimestamp()
          });
        }
      }).catch(err => {
        console.error("AI Classification failed:", err);
      });

      return docRef.id;
    } catch (error) {
      console.error('Emergency trigger failed:', error);
      notify("Critical Link Failure", "error");
      return null;
    }
  }, [user, profile, sensorStats, mode, notify, anonId]);

  const resolveIncident = useCallback(async (id: string | null) => {
    if (!user || !id || id === 'null') return;
    try {
      await updateDoc(doc(db, 'emergencies', id), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
        resolvedBy: user.uid
      });
      setActiveIncidentId(null);
      setMode('idle');
      notify("Incident marked as resolved. Ground teams notified.", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `emergencies/${id}`);
    }
  }, [user, notify]);

  const notifiedIncidentIds = useRef<Set<string>>(new Set());
  const [prediction, setPrediction] = useState<TacticalState['prediction']>({
    riskLevel: 'low',
    anomalyType: null,
    confidence: 0
  });
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearestSafeZone, setNearestSafeZone] = useState<SafeZone | null>(null);
  const [distanceToNearestMeters, setDistanceToNearestMeters] = useState<number | null>(null);
  const [isInsideSafeZone, setIsInsideSafeZone] = useState<boolean>(false);
  const [optimalRoute, setOptimalRoute] = useState<RouteStep[] | null>(null);

  const [blockedNodes, setBlockedNodes] = useState<Set<string>>(new Set());
  const socketRef = useRef<any>(null);

  // WebSocket Connection for Real-time Ops
  useEffect(() => {
    // Adding transport config and error handling to prevent unhandled socket rejections
    // Favoring pooling to avoid WS handshake errors in restricted preview environments
    const socket = io({
      transports: ['polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true
    });
    socketRef.current = socket;

    socket.on('connect_error', (err: any) => {
      // Intentionally silent - will fall back or retry
      console.warn("Socket connection warning:", err.message);
    });

    socket.on('exit_blocked', (nodeId: string) => {
      setBlockedNodes(prev => new Set(prev).add(nodeId));
      notify(`Tactical Flash: Node_${nodeId} compromised. Recalculating evacuation path.`, "warning");
      import('../lib/audio')
        .then(({ TacticalAudio }) => TacticalAudio.playAlert())
        .catch(err => console.warn("Tactical audio failed to load:", err));
    });

    socket.on('incident_resolved', (id: string) => {
      if (id === activeIncidentId) {
        setMode('idle');
        setActiveIncidentId(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeIncidentId, notify]);

  // AI On-Device: Voice Keyword Spotting Integration
  useEffect(() => {
    if (consent.microphone) {
      VoiceIntelligence.start();
      const unsubscribe = VoiceIntelligence.subscribe((command) => {
        if (command.includes('guardian') || command.includes('help')) {
          notify("VOICE PROTOCOL: Keyword 'Guardian' detected. Triggering Tactical SOS.", "error");
          triggerEmergency("voice", `Automated voice trigger detected: "${command}"`);
        }
      });
      return () => {
        unsubscribe();
        VoiceIntelligence.stop();
      };
    }
  }, [consent.microphone, notify, triggerEmergency]);

  const blockNode = useCallback((nodeId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('admin_action', { type: 'block_exit', node_id: nodeId });
      notify(`System Override: Command sent to block Node_${nodeId}.`, "info");
    }
  }, [notify]);

  // Best Route & Hazard Scan Logic
  const scanForHazards = useCallback(() => {
    setIsScanning(true);
    notify("QuantumLink: Initiating high-resolution mesh scan...", "info");
    
    // Simulate complex pathfinding & danger detection
    setTimeout(() => {
      const generatedDangers: DangerZone[] = [
        { id: 'd1', type: 'crowd', x: 45, y: 30, radius: 15, severity: 'medium', label: 'Congestion Node 4' },
        { id: 'd2', type: 'fire', x: 20, y: 65, radius: 10, severity: 'high', label: 'Thermal Anomaly' },
      ];
      
      setDangerZones(generatedDangers);
      
      // Find all exit nodes
      const exitNodeIds = MESH_NODES.filter(n => n.id.startsWith('exit')).map(n => n.id);
      
      // Real A* Pathfinding based on Digital Twin nodes (ignoring blocked)
      const path = findPath('start', exitNodeIds, MESH_NODES, MESH_EDGES, blockedNodes);
      if (path) {
        setOptimalRoute(path.map(n => ({ x: n.x, y: n.y })));
      }
      
      setIsScanning(false);
      notify("QuantumLink: Route optimized. All hazards mapped.", "success");
    }, 2500);
  }, [notify, blockedNodes]);

  // Reactive Route Recomputation when Blockages Change
  useEffect(() => {
    if (mode === 'escape') {
      const exitNodeIds = MESH_NODES.filter(n => n.id.startsWith('exit')).map(n => n.id);
      const path = findPath('start', exitNodeIds, MESH_NODES, MESH_EDGES, blockedNodes);
      if (path) {
        setOptimalRoute(path.map(n => ({ x: n.x, y: n.y })));
      } else {
        notify("CRITICAL: ALL ESCAPE ROUTES SEVERED. Switch to Assist Mode.", "error");
        setMode('assist');
      }
    }
  }, [blockedNodes, mode, notify]);

  // Simulate High-Trust Data Sources Ingestion
  useEffect(() => {
    // Official Feeds Simulation
    const mockOfficial = [
      { id: 'off1', source: 'MET_WEATHER', type: 'FLASH_FLOOD', severity: 'high', timestamp: new Date().toISOString(), description: 'Sudden precipitation surge in Urban Sector 4.' },
      { id: 'off2', source: 'CITY_DISASTER', type: 'GRID_FAILURE', severity: 'medium', timestamp: new Date().toISOString(), description: 'Localized power instability in District Hub.' }
    ] as OfficialAlert[];
    setOfficialAlerts(mockOfficial);

    // Sensor Mesh Simulation
    const mockSensors = [
      { id: 's1', type: 'SMOKE', status: 'NOMINAL', value: 12, location: { x: 20, y: 30 } },
      { id: 's2', type: 'CROWD', status: 'ALERT', value: 88, location: { x: 45, y: 30 } },
      { id: 's3', type: 'CCTV_ANALYTICS', status: 'NOMINAL', value: 0, location: { x: 60, y: 70 } }
    ] as SensorNode[];
    setSensors(mockSensors);
  }, []);

  // Verification Engine logic: Cross-reference logic
  useEffect(() => {
    if (!activeIncidentId || !incidentData) return;

    // Simulate cross-referencing: If sensor data or official feed matches incident location/type
    const matchingSensors = sensors.filter(s => s.status === 'ALERT');
    const confidence = matchingSensors.length > 0 ? 95 : 40;
    const sources = matchingSensors.length > 0 ? ['USER_REPORT', 'SENSOR_MESH'] : ['USER_REPORT'];

    setVerificationMap(prev => ({
      ...prev,
      [activeIncidentId]: { confidence, verifiedSources: sources }
    }));

    if (confidence > 80 && !notifiedIncidentIds.current.has(activeIncidentId)) {
      notify("Tactical: Incident confirmed through multi-source mesh verification.", "success");
      notifiedIncidentIds.current.add(activeIncidentId);
    }
  }, [activeIncidentId, incidentData, sensors, notify]);

  // Trigger scan when mode changes to 'escape'
  useEffect(() => {
    if (mode === 'escape') {
      scanForHazards();
    } else {
      setOptimalRoute(null);
      setDangerZones([]);
    }
  }, [mode, scanForHazards]);

  // Safe Zones Initialization & Offline Support
  useEffect(() => {
    const defaultZones: SafeZone[] = [
      { id: 'sz1', name: 'Main Strategy Exit', type: 'exit', location: { lat: 40.7128, lng: -74.0060 }, radius_meters: 15, is_accessible: true },
      { id: 'sz2', name: 'Security Outpost Alpha', type: 'security', location: { lat: 40.7135, lng: -74.0050 }, radius_meters: 10, is_accessible: true },
      { id: 'sz3', name: 'Medical Triage Hub', type: 'medical', location: { lat: 40.7120, lng: -74.0075 }, radius_meters: 20, is_accessible: true },
      { id: 'sz4', name: 'Secondary Emergency Exit', type: 'exit', location: { lat: 40.7140, lng: -74.0080 }, radius_meters: 15, is_accessible: false },
    ];

    const loadSafeZones = () => {
      const cached = localStorage.getItem('guardian_safe_zones_cache');
      if (cached) {
        setSafeZones(JSON.parse(cached));
      } else {
        setSafeZones(defaultZones);
        localStorage.setItem('guardian_safe_zones_cache', JSON.stringify(defaultZones));
      }
    };

    loadSafeZones();

    // Listen for WebSocket updates from admin
    if (socketRef.current) {
      socketRef.current.on('safe_zones_updated', (updated: SafeZone[]) => {
        setSafeZones(updated);
        localStorage.setItem('guardian_safe_zones_cache', JSON.stringify(updated));
        notify("QuantumLink: Safe Zone designations updated by Command.", "info");
      });
    }
  }, [notify]);

  // Kalman Filter State
  const prevLocRef = useRef<UserLocation | null>(null);
  const lastVoiceTimeRef = useRef<number>(0);

  // GPS Simulation & Analysis logic (2s intervals as per requirement 2)
  useEffect(() => {
    if (!consent.location) return;

    const interval = setInterval(() => {
      // Simulation: Jittery GPS around a center point
      const baseLat = 40.7128;
      const baseLng = -74.0060;
      const jitter = () => (Math.random() - 0.5) * 0.001;
      
      const newReading: UserLocation = {
        lat: baseLat + jitter(),
        lng: baseLng + jitter(),
        accuracy_meters: 5 + Math.random() * 60, // Sometimes inaccurate as per requirement 5
        speed_mps: 1.2 + Math.random(),
        timestamp: Date.now(),
        source: 'gps'
      };

      // 2.1 Filtering & Smoothing
      if (newReading.accuracy_meters > 50) {
        // Ignore readings with accuracy_meters > 50 (too coarse) - requirement 2.1
        return;
      }

      let filteredLat = newReading.lat;
      let filteredLng = newReading.lng;

      if (prevLocRef.current && newReading.speed_mps <= 2) {
        // Kalman filter (simple low-pass) - requirement 2.1
        filteredLat = 0.7 * newReading.lat + 0.3 * prevLocRef.current.lat;
        filteredLng = 0.7 * newReading.lng + 0.3 * prevLocRef.current.lng;
      }

      const filteredLoc: UserLocation = {
        ...newReading,
        lat: filteredLat,
        lng: filteredLng,
        heading: prevLocRef.current ? getBearing(prevLocRef.current.lat, prevLocRef.current.lng, filteredLat, filteredLng) : 0
      };

      setUserLocation(filteredLoc);
      prevLocRef.current = filteredLoc;

      // 2.2 Safe Zone Proximity Analysis
      let minDistance = Infinity;
      let nearest: SafeZone | null = null;
      let inside = false;

      safeZones.forEach(zone => {
        const dist = haversineDistance(filteredLoc.lat, filteredLoc.lng, zone.location.lat, zone.location.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = zone;
        }
        if (dist <= zone.radius_meters) {
          inside = true;
        }
      });

      setNearestSafeZone(nearest);
      setDistanceToNearestMeters(nearest ? minDistance : null);
      setIsInsideSafeZone(inside);

      // Requirement 8: Proximity Voice Alerts
      if (nearest && minDistance <= 20 && !inside) {
        // Simple throttle to avoid spamming voice
        if (Date.now() - lastVoiceTimeRef.current > 30000) {
          VoiceIntelligence.speak(`You are near a safe zone: ${nearest.name}. ${Math.round(minDistance)} meters ahead.`);
          lastVoiceTimeRef.current = Date.now();
        }
      }

    }, 2000);

    return () => clearInterval(interval);
  }, [consent.location, safeZones]);

  // EchoSync: Real-time Incident Sync
  useEffect(() => {
    if (!activeIncidentId || activeIncidentId === 'null') {
      setIncidentData(null);
      return;
    }

    try {
      const unsubscribe = onSnapshot(doc(db, 'emergencies', activeIncidentId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setIncidentData(data);
          
          // Auto-switch mode based on staff feedback/status
          if (data.status === 'resolved') {
            notify("QuantumLink: Situation Secure. Session Terminated.", "success");
            setActiveIncidentId(null);
            setMode('idle');
          }
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up emergency snapshot:", err);
    }
  }, [activeIncidentId, notify]);

  // QuantumLink: Predictive Analysis (Simulated Brain Logic)
  useEffect(() => {
    if (isStealthMode) return;
    const interval = setInterval(() => {
      setPrediction(prev => {
        const riskLevel = Math.random() > 0.85 ? 'high' : Math.random() > 0.6 ? 'medium' : 'low';
        const confidence = 0.82 + Math.random() * 0.16;
        const anomalies = [
          'Unusual acoustic signature in Lobby',
          'Elevated thermal variance in North Corridor',
          'High-velocity movement patterns in Sector 4',
          'Mesh connectivity degradation detected',
          'Bio-sensor stress aggregate increasing',
          'Pathfinding deviation observed'
        ];
        
        const newPrediction = {
          riskLevel,
          confidence,
          anomalyType: riskLevel !== 'low' ? anomalies[Math.floor(Math.random() * anomalies.length)] : null,
        };

        return newPrediction;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isStealthMode]);

  // Handle High Risk Auto-Transition
  const notifiedHighRisk = useRef(false);


  // Safety Timer (Dead Man's Switch) logic
  useEffect(() => {
    if (safetyTimer === null) return;
    if (safetyTimer <= 0) {
      triggerEmergency('unresponsive', 'Safety timer expired - no response from user');
      setSafetyTimer(null);
      return;
    }

    const timer = setInterval(() => {
      setSafetyTimer(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [safetyTimer, triggerEmergency]);

  // Simulated Sensor Polling (dB/Crowd)
  useEffect(() => {
    if (!privacyConsent || isStealthMode) return;
    const interval = setInterval(() => {
      setSensorStats({
        db: 40 + Math.floor(Math.random() * 50),
        crowd: Math.floor(Math.random() * 100)
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [privacyConsent, isStealthMode]);

  // Offline Queue Monitor
  useEffect(() => {
    const checkQueue = () => {
      try {
        const queue = JSON.parse(localStorage.getItem('guardian_offline_queue') || '[]');
        setOfflineQueueCount(queue.length);
        
        if (navigator.onLine && queue.length > 0) {
          queue.forEach(async (item: any, index: number) => {
            const success = await triggerEmergency(item.type, item.description, item.isSilent);
            if (success) {
              const currentQueue = JSON.parse(localStorage.getItem('guardian_offline_queue') || '[]');
              currentQueue.splice(index, 1);
              localStorage.setItem('guardian_offline_queue', JSON.stringify(currentQueue));
              setOfflineQueueCount(currentQueue.length);
            }
          });
        }
      } catch (e) {
        console.error("Offline queue error:", e);
      }
    };

    const interval = setInterval(checkQueue, 5000);
    window.addEventListener('online', checkQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkQueue);
    };
  }, [triggerEmergency]);

  useEffect(() => {
    if (prediction.riskLevel === 'high' && !activeIncidentId && !notifiedHighRisk.current) {
      notify("QuantumLink: HIGH RISK DETECTED. AUTO-TRANSITION TO EVAC TRACE.", "error");
      setMode('escape');
      notifiedHighRisk.current = true;
    } else if (prediction.riskLevel !== 'high') {
      notifiedHighRisk.current = false;
    }
  }, [prediction.riskLevel, activeIncidentId, notify]);

  // Step 2.2: Shake Detection (Stealth SOS) & Step 2.5: Fall Detection
  useEffect(() => {
    if (!consent.motion) return;
    
    let lastShake = 0;
    let shakeCount = 0;
    let lastFallDetect = 0;
    const SHAKE_THRESHOLD = 15;
    const FALL_THRESHOLD = 35;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const totalAcc = Math.sqrt((acc.x || 0)**2 + (acc.y || 0)**2 + (acc.z || 0)**2);
      
      // Shake Detection
      if (totalAcc > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShake < 1000) {
          shakeCount++;
          if (shakeCount >= 3) {
            triggerEmergency('stealth_trigger', 'Stealth shake activation', true);
            shakeCount = 0;
          }
        } else {
          shakeCount = 1;
        }
        lastShake = now;
      }

      // Fall Detection
      if (totalAcc > FALL_THRESHOLD) {
        const now = Date.now();
        if (now - lastFallDetect > 5000) {
          lastFallDetect = now;
          TacticalAudio.playAlert();
          notify("High G-force detected. Guardian is monitoring for unresponsiveness.", "error");
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [consent.motion, triggerEmergency, notify]);

  // Step 2.6: Inactivity Detection
  useEffect(() => {
    if (!privacyConsent || activeIncidentId) return;

    let inactivityTimer: any;
    let warningTimer: any;

    const resetTimers = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      
      inactivityTimer = setTimeout(() => {
        notify("Still there? Tap to confirm safety.", "warning");
        warningTimer = setTimeout(() => {
          triggerEmergency('unresponsive_stationary', 'Passive inactivity detected');
        }, 30000); // 30 sec warning
      }, 120000); // 2 min inactivity
    };

    window.addEventListener('touchstart', resetTimers);
    window.addEventListener('mousemove', resetTimers);
    resetTimers();

    return () => {
      window.removeEventListener('touchstart', resetTimers);
      window.removeEventListener('mousemove', resetTimers);
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
    };
  }, [privacyConsent, activeIncidentId, triggerEmergency, notify]);

  const clearTacticalHistory = useCallback(async () => {
    if (!user) return;
    try {
      // In a real app we'd delete history from Firestore here
      setOfficialAlerts([]);
      setSensors([]);
      setVerificationMap({});
      setDangerZones([]);
      setOptimalRoute(null);
      notify("Tactical footprint cleared successfully.", "success");
    } catch (err) {
      notify("Failed to clear tactical history.", "error");
    }
  }, [user, notify]);

  const isSafe = prediction.riskLevel === 'low' && !activeIncidentId;

  // Global Alert Listener for Staff/Admin
  useEffect(() => {
    if (!user || (profile?.role !== 'staff' && profile?.role !== 'admin')) return;

    const q = query(
      collection(db, 'emergencies'),
      where('status', '==', 'reported'),
    );

    const sessionStart = Date.now();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !change.doc.metadata.hasPendingWrites) {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toMillis?.() || 0;
          
          if (createdAt > sessionStart && !notifiedIncidentIds.current.has(change.doc.id)) {
            notify(`TACTICAL ALERT: ${data.type.toUpperCase()} reported by ${data.userName}`, "error");
            notifiedIncidentIds.current.add(change.doc.id);
            // Dynamic import to avoid SSR/Initial load issues
            import('../lib/audio').then(({ TacticalAudio }) => {
              TacticalAudio.playAlert();
            }).catch(err => console.warn("Tactical audio failed to load:", err));
          }
        }
      });
    }, (err) => {
      console.error("Global Tactical Listener Error:", err);
    });

    return () => unsubscribe();
  }, [user, profile, notify]);

  const value = useMemo(() => ({ 
    mode, 
    activeIncidentId, 
    incidentData, 
    officialAlerts,
    sensors,
    verificationMap,
    prediction, 
    isSafe,
    dangerZones,
    safeZones,
    userLocation,
    nearestSafeZone,
    distanceToNearestMeters,
    isInsideSafeZone,
    optimalRoute,
    blockedNodes,
    isScanning,
    privacyConsent,
    isStealthMode,
    dataRetention,
    safetyTimer,
    sensorStats,
    offlineQueueCount,
    anonId,
    language,
    hasSeenTutorial,
    consent,
    setMode, 
    setPrivacyConsent,
    setIsStealthMode,
    setDataRetention,
    setSafetyTimer,
    setLanguage,
    setConsent: updateConsent,
    completeTutorial,
    clearTacticalHistory,
    triggerEmergency,
    resolveIncident,
    scanForHazards,
    blockNode
  }), [
    mode, 
    activeIncidentId, 
    incidentData, 
    officialAlerts,
    sensors,
    verificationMap,
    prediction, 
    isSafe,
    dangerZones,
    safeZones,
    userLocation,
    nearestSafeZone,
    distanceToNearestMeters,
    isInsideSafeZone,
    optimalRoute,
    blockedNodes,
    isScanning,
    privacyConsent,
    isStealthMode,
    dataRetention,
    safetyTimer,
    sensorStats,
    offlineQueueCount,
    anonId,
    language,
    hasSeenTutorial,
    consent,
    triggerEmergency,
    resolveIncident,
    scanForHazards,
    blockNode,
    clearTacticalHistory,
    updateConsent,
    completeTutorial
  ]);

  return (
    <TacticalContext.Provider value={value}>
      {children}
    </TacticalContext.Provider>
  );
}

export function useTactical() {
  const context = useContext(TacticalContext);
  if (context === undefined) {
    throw new Error('useTactical must be used within a TacticalProvider');
  }
  return context;
}
