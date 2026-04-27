import React, { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

export default function ErrorBoundary({ children }: Props) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-12 text-center bg-slate-950 border border-red-500/20 rounded-[3rem] space-y-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-red-500">
          <AlertTriangle className="w-10 h-10 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">System Malfunction</h2>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.3em]">Runtime logic severed. Mesh synchronization failed.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          <RefreshCcw className="w-4 h-4" />
          Re-Initialize Mesh
        </button>
        {error && (
          <p className="text-[8px] font-mono text-slate-700 max-w-xs break-all">
            Kernel Error: {error.message}
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
