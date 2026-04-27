import { useState, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, limit, serverTimestamp, getDocs, addDoc, where } from 'firebase/firestore';
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Clock, 
  ChevronRight, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Filter,
  BarChart3,
  Users,
  X,
  ShieldAlert,
  TrendingUp,
  BrainCircuit,
  WifiOff,
  Wifi,
  Radio,
  Signal,
  Cpu
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { useNotify } from '../contexts/NotificationContext';
import { TacticalAudio } from '../lib/audio';
import TacticalFeed from './TacticalFeed';
import CrisisChat from './CrisisChat';
import VenueMap from './VenueMap';

import { useTactical } from '../contexts/TacticalContext';

import MFADialog from './MFADialog';
import { useAuth } from '../contexts/AuthContext';

export default function StaffDashboard() {
  const { prediction, isSafe, officialAlerts, sensors, verificationMap } = useTactical();
  const { logAuditAction } = useAuth();
  const { notify, isOnline } = useNotify();
  const [activeTab, setActiveTab] = useState<'alerts' | 'predictive' | 'deployment'>('alerts');
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [filter, setFilter] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await fetch('/api/heatmap');
      const data = await res.json();
      setHeatmapData(data);
    } catch (err) {
      console.error("Heatmap fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 10000); // 10s sync
    return () => clearInterval(interval);
  }, [fetchHeatmap]);

  const [stats, setStats] = useState({
    active: 0,
    resolved: 0,
    avgResponse: '4.2m',
    riskLevel: 'Nominal'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'emergencies'), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    setIsSyncing(true);
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Phase 6.2: EchoSync - Automatic Clustering
      // In a real app we'd compare GPS. Here we simulate clustering by type and proximity in time.
      const clusters: Record<string, any[]> = {};
      docs.forEach((d: any) => {
        if (d.status === 'resolved') return;
        const key = `${d.type}_${Math.floor((d.createdAt?.toMillis?.() || Date.now()) / 60000)}`;
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(d);
      });
      
      setEmergencies(docs.map((d: any) => {
        const key = `${d.type}_${Math.floor((d.createdAt?.toMillis?.() || Date.now()) / 60000)}`;
        return { ...d, clusterSize: clusters[key]?.length || 1 };
      }));

      setIsSyncing(snapshot.metadata.hasPendingWrites);
      
      const active = docs.filter((d: any) => d.status !== 'resolved');
      const resolved = docs.filter((d: any) => d.status === 'resolved');
      
      let risk = 'Nominal';
      const criticalCount = active.filter((d: any) => d.type === 'fire' || d.type === 'harassment').length;
      if (criticalCount > 5) risk = 'Critical';
      else if (criticalCount > 2 || active.length > 10) risk = 'High';
      else if (active.length > 5) risk = 'Moderate';

      const responseTimes = docs
        .filter((d: any) => d.dispatchedAt || d.onSiteAt)
        .map((d: any) => {
          const start = d.createdAt?.toDate ? d.createdAt.toDate().getTime() : new Date(d.createdAt).getTime();
          const response = new Date(d.dispatchedAt || d.onSiteAt).getTime();
          return (response - start) / 1000 / 60; 
        })
        .filter(time => time > 0 && time < 15);

      const avgResp = responseTimes.length > 0 
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) + 'm'
        : '2.1m';

      setStats(prev => ({ 
        ...prev, 
        active: active.length, 
        resolved: resolved.length,
        avgResponse: avgResp,
        riskLevel: prediction.riskLevel
      }));

      // Notifications are now handled globally by TacticalContext
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'emergencies');
      notify("Failed to sync emergency mesh.", "error");
    });

    return () => unsubscribe();
  }, []);

  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleGlobalBroadcast = (text: string) => {
    if (!text.trim()) return;
    
    setPendingAction(() => async () => {
      setIsBroadcasting(true);
      try {
        await logAuditAction('GLOBAL_BROADCAST', { message: text });
        const activeQueries = query(collection(db, 'emergencies'), where('status', '!=', 'resolved'));
        const snapshot = await getDocs(activeQueries);
        
        const promises = snapshot.docs.map(incident => 
          addDoc(collection(db, `emergencies/${incident.id}/messages`), {
            text: `[GLOBAL BROADCAST]: ${text}`,
            senderId: 'SYSTEM',
            senderName: 'Command Center',
            senderRole: 'admin',
            createdAt: serverTimestamp(),
            type: 'system'
          })
        );

        await Promise.all(promises);
        notify(`Broadcast uplinked to ${snapshot.size} active nodes.`, "success");
      } catch (err) {
        notify("Broadcast uplink failed.", "error");
        console.error(err);
      } finally {
        setIsBroadcasting(false);
      }
    });

    setMfaOpen(true);
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    if (!id || id === 'null') return;
    TacticalAudio.playBlip(1400, 0.05);
    try {
      const updateData: any = { 
        status,
        updatedAt: serverTimestamp()
      };
      
      if (status === 'dispatched') updateData.dispatchedAt = serverTimestamp();
      if (status === 'on_site') updateData.onSiteAt = serverTimestamp();
      if (status === 'resolved') updateData.resolvedAt = serverTimestamp();

      await updateDoc(doc(db, 'emergencies', id), updateData);
      setSelectedIncident(null);
      
      const messages: Record<string, string> = {
        dispatched: "TACTICAL: Response units deployed. GPS sync active.",
        on_site: "UPLINK: Force arrival confirmed. Sector node secured.",
        resolved: "PROTOCOL: Incident terminated. Threat level: NOMINAL."
      };
      
      notify(messages[status] || `Incident ${status.toUpperCase()} confirmed.`, "success");
    } catch (err) {
      notify("Failed to update incident status.", "error");
      handleFirestoreError(err, OperationType.UPDATE, `emergencies/${id}`);
    }
  };

  const filteredIncidents = emergencies.filter(i => {
    if (filter === 'all') return true;
    if (filter === 'active') return i.status !== 'resolved';
    if (filter === 'critical') return i.severity === 'critical' || i.type === 'fire';
    return true;
  });

  const chartData = [
    { time: '00:00', alerts: 2 },
    { time: '04:00', alerts: 1 },
    { time: '08:00', alerts: 5 },
    { time: '12:00', alerts: 8 },
    { time: '16:00', alerts: 12 },
    { time: '20:00', alerts: 7 },
    { time: '23:59', alerts: 4 },
  ];

  const riskData = [
    { name: 'Low', value: 70, color: '#10b981' },
    { name: 'Med', value: 20, color: '#f59e0b' },
    { name: 'High', value: 10, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 h-full flex flex-col p-2 md:p-0">
       {/* Tactical HUD Header */}
       <div className="flex items-center justify-between mb-2">
         <div className="flex gap-2">
           {['alerts', 'predictive', 'deployment'].map((tab) => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={cn(
                 "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                 activeTab === tab ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 text-slate-500 hover:bg-white/10"
               )}
             >
               {tab}
             </button>
           ))}
         </div>
         <div className="hidden md:flex items-center gap-4">
            {isSafe && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                 <ShieldCheck className="w-3 h-3 text-emerald-500" />
                 <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest font-black">SECURE_MESH_NOMINAL</span>
              </div>
            )}
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Mesh_Live</span>
            </div>
         </div>
       </div>

       {activeTab === 'alerts' && (
         <>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Live Mesh Alerts', value: stats.active, icon: Activity, color: 'indigo-500' },
          { label: 'Uplink Health', value: '98.2%', icon: Wifi, color: 'emerald-500' },
          { label: 'Tactical Resp', value: stats.avgResponse, icon: Clock, color: 'indigo-500' },
          { label: 'Risk Protocol', value: stats.riskLevel.toUpperCase(), icon: ShieldAlert, color: stats.riskLevel === 'Critical' ? 'red-500' : 'emerald-500' },
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-5 glass-panel rounded-[2rem] space-y-1 tactical-border relative overflow-hidden group"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent group-hover:via-indigo-500/40 transition-colors" />
             <div className="flex items-center justify-between pointer-events-none">
                <div className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-500 text-ellipsis overflow-hidden whitespace-nowrap">{stat.label}</div>
                <stat.icon className={cn("w-4 h-4 opacity-50", `text-${stat.color}`)} />
             </div>
             <div className="text-2xl font-black text-white tracking-tighter">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* AI Prediction Insight Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 rounded-[2.5rem] tactical-border bg-indigo-500/5 flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shrink-0">
            <BrainCircuit className="w-7 h-7 text-indigo-500 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">AI Predictive Intelligence</div>
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-2xl font-black uppercase italic tracking-tighter",
                prediction.riskLevel === 'high' ? "text-red-500" : prediction.riskLevel === 'medium' ? "text-amber-500" : "text-emerald-500"
              )}>
                {prediction.riskLevel} Risk
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-mono text-indigo-400 uppercase font-black">{(prediction.confidence * 100).toFixed(0)}% Confidence</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Live Anomaly Assessment</span>
          <p className="text-xs text-indigo-200 font-mono italic">
            {prediction.anomalyType ? `ANOMALY DETECTED: ${prediction.anomalyType}` : "NO STRUCTURAL ANOMALIES DETECTED IN CURRENT MESH CYCLE."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setActiveTab('predictive')}
            className="px-6 py-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-xl active:scale-95"
          >
            Insights Hub
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left Column: Command & Analytics */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="glass-panel border-slate-800 rounded-[2.5rem] p-6 backdrop-blur-sm relative overflow-hidden tactical-border">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Signal className="w-3 h-3 text-indigo-500" />
                      Official Safety Feeds
                   </h3>
                   <div className="text-[8px] font-mono text-slate-500 uppercase">UPLINK_STABLE</div>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-[160px] scrollbar-hide pr-2">
                   {officialAlerts.length > 0 ? officialAlerts.map(alert => (
                     <div key={alert.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                           <span className={cn(
                             "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                             alert.severity === 'high' ? "bg-red-500/20 text-red-400" : "bg-indigo-500/20 text-indigo-400"
                           )}>{alert.source}</span>
                           <span className="text-[7px] font-mono text-slate-500 uppercase">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] font-bold text-white uppercase tracking-tight">{alert.type}</p>
                        <p className="text-[9px] text-slate-500 mt-1 line-clamp-1 italic">{alert.description}</p>
                     </div>
                   )) : (
                     <div className="flex flex-col items-center justify-center h-24 text-slate-600">
                        <Wifi className="w-6 h-6 mb-2 opacity-20" />
                        <span className="text-[8px] font-mono uppercase tracking-[0.2em]">Synchronizing_Nodes...</span>
                     </div>
                   )}
                </div>
             </div>

             <div className="glass-panel border-slate-800 rounded-[2.5rem] p-6 backdrop-blur-sm relative overflow-hidden tactical-border">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Cpu className="w-3 h-3 text-emerald-500" />
                      Local Sensor Mesh
                   </h3>
                   <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[7px] font-black uppercase rounded">Healthy</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   {sensors.map(sensor => (
                     <div key={sensor.id} className="p-3 bg-slate-950/40 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-default text-left">
                        <div className="flex items-center gap-2 mb-2">
                           <div className={cn(
                             "w-1.5 h-1.5 rounded-full animate-pulse",
                             sensor.status === 'ALERT' ? "bg-red-500" : "bg-emerald-500"
                           )} />
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{sensor.type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-end justify-between">
                           <span className="text-sm font-black text-white font-mono">{sensor.value}{sensor.type === 'SMOKE' ? 'ppm' : '%'}</span>
                           <span className="text-[7px] font-mono text-slate-600 uppercase">S-{sensor.id.slice(-2)}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="glass-panel border-slate-800 rounded-[2.5rem] p-6 bg-slate-900/20 tactical-border h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Live_Incident_Heatmap</span>
              </div>
              <div className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[7px] font-black uppercase rounded">High Risk Detection</div>
            </div>
            
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    type="number" 
                    dataKey="lng" 
                    name="longitude" 
                    domain={['auto', 'auto']} 
                    hide 
                  />
                  <YAxis 
                    type="number" 
                    dataKey="lat" 
                    name="latitude" 
                    domain={['auto', 'auto']} 
                    hide 
                  />
                  <ZAxis 
                    type="number" 
                    dataKey="intensity" 
                    range={[100, 1500]} 
                    name="severity" 
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }}
                    itemStyle={{ color: '#818cf8', fontWeight: '900', textTransform: 'uppercase' }}
                  />
                  <Scatter 
                    name="Incidents" 
                    data={heatmapData} 
                    fill="#ef4444" 
                    fillOpacity={0.6}
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-red-500/5 rounded-2xl border border-red-500/10">
               <p className="text-[8px] text-red-400 font-mono uppercase tracking-widest text-center">
                  Risk clusters identified at Sector {heatmapData.length > 0 ? 'G/F' : 'N/A'}. Cross-referencing mesh nodes...
               </p>
            </div>
          </div>

          <div className="glass-panel border-slate-800 rounded-[2.5rem] p-6 bg-slate-900/20 tactical-border">
            <div className="flex items-center gap-3 mb-4">
              <Radio className="w-5 h-5 text-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Crisis_Broadcast_Uplink</span>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const target = e.target as any;
                handleGlobalBroadcast(target.broadcast.value);
                target.broadcast.value = '';
              }}
              className="flex gap-4"
            >
              <input 
                name="broadcast"
                placeholder="Enter tactical message for all active mesh nodes..."
                className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500/40 transition-all font-mono placeholder:text-slate-700 text-indigo-200"
              />
              <button 
                type="submit"
                disabled={isBroadcasting}
                className="px-6 py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                {isBroadcasting ? 'SYNCHING...' : 'BROADCAST'}
              </button>
            </form>
          </div>

          <div className="glass-panel rounded-[3rem] overflow-hidden flex-1 relative shadow-2xl tactical-border min-h-[500px] p-6">
             <VenueMap />
          </div>
        </div>

        {/* Right Column: Incident List & Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6 min-h-0">
           <div className="glass-panel border-slate-800/80 rounded-[2.5rem] overflow-hidden flex flex-col min-h-0 tactical-border h-2/3">
             <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                <span className="font-black text-[9px] uppercase tracking-[0.3em] flex items-center gap-2 text-indigo-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                  EVENT_STREAM_LINK
                </span>
             </div>
             <div className="overflow-y-auto divide-y divide-white/5">
                {filteredIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() => {
                      TacticalAudio.playBlip(1100, 0.03);
                      setSelectedIncident(incident);
                    }}
                    className={cn(
                      "w-full p-4 flex gap-4 text-left hover:bg-white/5 transition-all relative group",
                      selectedIncident?.id === incident.id && "bg-indigo-500/5"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                      incident.severity === 'critical' ? "border-red-500/20 bg-red-500/5 text-red-500" : "border-white/10 bg-white/5 text-slate-400"
                    )}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase text-white tracking-widest">{incident.type}</span>
                          <span className="text-[8px] font-mono text-slate-500 font-bold uppercase">{formatDistanceToNow(incident.createdAt?.toDate ? incident.createdAt.toDate() : new Date())} ago</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <MapPin className="w-2.5 h-2.5 text-slate-600" />
                          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">LOBBY_G_NODE</span>
                       </div>
                    </div>
                  </button>
                ))}
             </div>
           </div>

           <div className="h-1/3 min-h-[250px]">
              <TacticalFeed />
           </div>
        </div>
      </div>
    </>
    )}

      {activeTab === 'predictive' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-8 duration-700 h-full">
           <div className="lg:col-span-2 space-y-8">
              <div className="glass-panel p-8 rounded-[3rem] tactical-border bg-indigo-500/5">
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-indigo-600/10 rounded-3xl flex items-center justify-center border border-indigo-500/20">
                      <BrainCircuit className="w-8 h-8 text-indigo-500 animate-pulse" />
                    </div>
                    <div>
                       <h2 className="text-2xl font-black text-white uppercase tracking-tight">QuantumLink Foresight</h2>
                       <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em]">AI-Driven Risk Modeling // Real-time Feed</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Current Anomaly Risk</span>
                          <div className={cn(
                            "text-5xl font-black italic tracking-tighter",
                            prediction.riskLevel === 'high' ? "text-red-500" : prediction.riskLevel === 'medium' ? "text-amber-500" : "text-emerald-500"
                          )}>
                             {prediction.riskLevel.toUpperCase()} [{(prediction.confidence * 100).toFixed(0)}%]
                          </div>
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${prediction.confidence * 100}%` }}
                               className={cn(
                                 "h-full rounded-full",
                                 prediction.riskLevel === 'high' ? "bg-red-500" : prediction.riskLevel === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                               )}
                             />
                          </div>
                       </div>
                       <div className="p-6 bg-slate-950/40 rounded-[2rem] border border-white/5 space-y-2">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Anomaly Source Identification</span>
                          <p className="text-sm text-indigo-200 font-mono italic">"{prediction.anomalyType || 'No structural anomalies detected in current mesh cycle.'}"</p>
                       </div>
                    </div>
                    <div className="h-56 relative group">
                        <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie data={riskData} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                                 {riskData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                 ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '10px', textTransform: 'uppercase' }} />
                           </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {[
                   { title: 'Crowd Density', val: 'Low (12%)', desc: 'Predicting slight buildup in Sector 4' },
                   { title: 'Heatmap Anomaly', val: '0.04 Variance', desc: 'Thermal patterns within nominal variance' }
                 ].map((box, i) => (
                   <div key={i} className="p-8 glass-panel rounded-[2.5rem] tactical-border bg-white/[0.02]">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{box.title}</h4>
                      <div className="text-3xl font-black text-white italic tracking-tighter mb-2">{box.val}</div>
                      <p className="text-[10px] text-indigo-400/60 font-mono uppercase tracking-[0.2em] leading-relaxed">{box.desc}</p>
                   </div>
                 ))}
              </div>
           </div>

           <div className="glass-panel p-8 rounded-[3.5rem] tactical-border flex flex-col h-full bg-slate-950/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Active Simulations</h3>
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 tactical-scrollbar">
                 {[
                   { type: 'Fire Spread', prob: '0.02%', status: 'Inert', icon: ShieldCheck },
                   { type: 'Exodus Pattern', prob: '1.4%', status: 'Nominal', icon: TrendingUp },
                   { type: 'Structural Stress', prob: '0.001%', status: 'Locked', icon: ShieldAlert }
                 ].map((sim, i) => (
                   <div key={i} className="p-5 bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <sim.icon className="w-4 h-4" />
                         </div>
                         <div>
                            <div className="text-xs font-black text-white tracking-widest uppercase">{sim.type}</div>
                            <div className="text-[10px] font-mono text-slate-500">Probability: {sim.prob}</div>
                         </div>
                      </div>
                      <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 uppercase tracking-widest">{sim.status}</div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'deployment' && (
        <div className="animate-in zoom-in-95 duration-700 h-full grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 glass-panel p-10 rounded-[3.5rem] tactical-border flex flex-col gap-8 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-600/20">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">AI Role Assignment</h2>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">Dynamic Mesh Load Balancing</p>
                    </div>
                 </div>
                 <div className="px-6 py-2 bg-indigo-600 border border-indigo-400 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-indigo-600/20">Auto-balancing Active</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                 {[
                   { name: 'Sarah Chen', role: 'Medical Specialist', status: 'Deployed - Floor 3', pos: 'near Room 304' },
                   { name: 'Markus Voss', role: 'Evacuation Lead', status: 'Standby - Command', pos: 'Central Hub' },
                   { name: 'Althea Ray', role: 'Containment', status: 'Mobile - Sector G', pos: 'Stairwell B' },
                   { name: 'Jackson Holt', role: 'Logistics', status: 'Mobile - Transit', pos: 'Loading Dock' }
                 ].map((staff, i) => (
                   <div key={i} className="p-8 bg-slate-900 border border-white/5 rounded-[3rem] flex flex-col gap-4 relative group overflow-hidden hover:border-indigo-500/30 transition-all">
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                         <ShieldCheck className="w-16 h-16 text-indigo-500" />
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 text-lg font-black italic">
                            {staff.name[0]}
                         </div>
                         <div>
                            <div className="text-base font-black text-white tracking-widest uppercase">{staff.name}</div>
                            <div className="text-[10px] font-mono text-indigo-500/60 uppercase tracking-widest font-bold">{staff.role}</div>
                         </div>
                      </div>
                      <div className="space-y-3 mt-2 font-mono">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                           <span className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">{staff.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 text-[10px] tracking-wider uppercase">
                           <MapPin className="w-4 h-4 text-slate-700" />
                           {staff.pos}
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
           
           <div className="glass-panel p-10 rounded-[3.5rem] tactical-border flex flex-col gap-8 bg-slate-950/40">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Mesh Load Hub</h3>
              <div className="space-y-8 flex-1">
                 {[
                   { id: 'Alpha-7', load: '12%', status: 'Nominal', color: 'bg-indigo-500' },
                   { id: 'Beta-2', load: '84%', status: 'Warning', color: 'bg-red-500' },
                   { id: 'Gamma-9', load: '32%', status: 'Nominal', color: 'bg-emerald-500' },
                   { id: 'Delta-4', load: '55%', status: 'Nominal', color: 'bg-indigo-500' }
                 ].map((node, i) => (
                   <div key={i} className="space-y-3">
                      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                         <span className="text-slate-500">Node_{node.id}</span>
                         <span className={node.status === 'Warning' ? "text-red-500" : "text-emerald-500"}>{node.load}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden shadow-inner flex p-[1px]">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: node.load }}
                           className={cn("h-full rounded-full", node.color)} 
                         />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono uppercase text-slate-700 tracking-widest">
                         <span>Status: {node.status}</span>
                         <span>Relay_Active</span>
                      </div>
                   </div>
                 ))}
              </div>
              <button className="w-full py-4 bg-indigo-600/10 border border-indigo-500/30 rounded-[1.5rem] text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] hover:bg-indigo-600 hover:text-white transition-all shadow-xl">Rebalance_All_Nodes</button>
           </div>
        </div>
      )}

      {/* Popups & Dialogs */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-xl">
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="glass-panel w-full max-w-6xl h-full md:h-[85vh] rounded-[3rem] tactical-border flex flex-col md:flex-row overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.2)] bg-slate-950/40"
             >
                {/* Left: Incident Details (Action Panel) */}
                <div className="md:w-5/12 p-8 md:p-12 space-y-8 flex flex-col overflow-y-auto border-r border-white/5 bg-slate-950/40">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                            <ShieldAlert className="w-8 h-8 animate-pulse" />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{selectedIncident.type}_DETECTED</h2>
                            <p className="text-[10px] text-slate-500 font-mono tracking-[0.3em] uppercase">ID: {selectedIncident.id.slice(0, 16)}</p>
                         </div>
                      </div>
                      <button onClick={() => setSelectedIncident(null)} className="md:hidden w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                         <X className="w-5 h-5" />
                      </button>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                         <span>Situation_Brief</span>
                         <span className={cn(
                           "px-2 py-0.5 rounded border",
                           selectedIncident.severity === 'critical' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                         )}>
                            {selectedIncident.severity || 'Medium'}_PRIORITY
                         </span>
                      </div>
                      <p className="text-sm text-slate-300 italic font-mono leading-relaxed bg-slate-950/50 p-6 rounded-3xl border border-white/5 shadow-inner">
                         "{selectedIncident.description || "Mesh-initiated automated priority alert. No manual description provided by node."}"
                      </p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                         <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Reporter_ID</span>
                         <div className="text-xs font-mono text-slate-400">{selectedIncident.userId.slice(0, 12)}</div>
                      </div>
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                         <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Timestamp</span>
                         <div className="text-xs font-mono text-slate-400">
                            {selectedIncident.createdAt?.toDate ? selectedIncident.createdAt.toDate().toLocaleTimeString() : '...'}
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                         <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Acoustics</span>
                         <div className="text-xs font-black text-white">{selectedIncident.environmental?.db || '--'} dB</div>
                      </div>
                      <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                         <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Crowd</span>
                         <div className="text-xs font-black text-white">{selectedIncident.environmental?.crowd || '--'}%</div>
                      </div>
                      <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                         <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Cluster</span>
                         <div className="text-xs font-black text-red-400">{selectedIncident.clusterSize || 1} Nodes</div>
                      </div>
                   </div>

                   <div className="flex-1" />

                   <div className="space-y-4 pt-8">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Operational_Overrides</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                          onClick={() => handleStatusUpdate(selectedIncident.id, 'dispatched')}
                          className={cn(
                            "py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                            selectedIncident.status === 'dispatched' ? "bg-indigo-600 border-indigo-400 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                          )}
                        >
                          DEPLOY_FORCE
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(selectedIncident.id, 'on_site')}
                          className={cn(
                            "py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                            selectedIncident.status === 'on_site' ? "bg-emerald-600 border-emerald-400 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                          )}
                        >
                          CONFIRM_ARRIVAL
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(selectedIncident.id, 'resolved')}
                          className="py-4 bg-slate-900 border border-emerald-500/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all col-span-1 sm:col-span-2"
                        >
                          TERMINATE_INCIDENT
                        </button>
                      </div>
                   </div>
                </div>

                {/* Right: Real-time Communication Hub */}
                <div className="flex-1 flex flex-col p-4 md:p-8 bg-slate-900/30 relative">
                  <div className="absolute top-6 right-6 z-20">
                     <button onClick={() => setSelectedIncident(null)} className="hidden md:flex w-10 h-10 rounded-full bg-slate-950 border border-white/5 items-center justify-center text-slate-500 hover:text-white transition-colors group">
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                     </button>
                  </div>
                  
                  <div className="flex-1 min-h-0 pt-4">
                     <CrisisChat emergencyId={selectedIncident.id} role="staff" />
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MFADialog 
        isOpen={mfaOpen}
        onClose={() => setMfaOpen(false)}
        actionName="Crisis Broadcast"
        onVerify={() => {
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
      />
    </div>
  );
}
