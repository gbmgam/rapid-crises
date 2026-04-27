import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

type NotificationType = 'error' | 'success' | 'info';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
  isOnline: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      notify("Uplink Restored: Mesh Synchronizing", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      notify("Uplink Severed: Edge Storage Active", "error");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeItem = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const memoizedValue = useMemo(() => ({ notify, isOnline }), [notify, isOnline]);

  return (
    <NotificationContext.Provider value={memoizedValue}>
      {children}
      <div className="fixed bottom-12 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-2xl border backdrop-blur-md flex items-start gap-4 shadow-2xl ${
                n.type === 'error' ? 'bg-red-950/80 border-red-500/50 text-red-100' :
                n.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-100' :
                'bg-slate-900/80 border-slate-700 text-slate-100'
              }`}
            >
              {n.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
              <p className="text-xs font-bold uppercase tracking-widest leading-relaxed flex-1">{n.message}</p>
              <button onClick={() => removeItem(n.id)} className="text-inherit opacity-50 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotify must be used within a NotificationProvider');
  }
  return context;
}
