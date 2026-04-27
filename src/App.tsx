/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { TacticalProvider, useTactical } from './contexts/TacticalContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import GuestSOS from './components/GuestSOS';
import StaffDashboard from './components/StaffDashboard';
import AdminPanel from './components/AdminPanel';
import VenueMap from './components/VenueMap';
import RoleSelection from './components/RoleSelection';
import Settings from './components/Settings';
import SafetyMode from './components/SafetyTimer';
import { PrivacyDashboard } from './components/PrivacyDashboard';
import Onboarding from './components/Onboarding';
import PersonnelManagement from './components/PersonnelManagement';
import ErrorBoundary from './components/ErrorBoundary';
import { Shield } from 'lucide-react';

import AuthUI from './components/AuthUI';

function AppContent() {
  const { user, profile, loading, updateRole } = useAuth();
  const { activeIncidentId, mode, hasSeenTutorial } = useTactical();
  const [activeTab, setActiveTab] = useState('sos');

  // Auto-pivot to SOS or Dashboard if there is an active incident or high-risk mode
  useEffect(() => {
    // Only pivot if tutorial seen and user exists
    if (!hasSeenTutorial || !profile?.role) return;

    if (activeIncidentId || mode === 'escape' || mode === 'assist') {
      if (profile?.role === 'staff' || profile?.role === 'admin') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('sos');
      }
    }
  }, [activeIncidentId, mode, profile?.role, hasSeenTutorial]);

  // Show onboarding if tutorial not seen
  if (!hasSeenTutorial) {
    return <Onboarding />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-xl animate-spin" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Syncing Mesh</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthUI />;
  }

  if (!profile?.role) {
    return <RoleSelection />;
  }

  const canAccess = (tabId: string) => {
    const role = profile?.role;
    if (tabId === 'sos' || tabId === 'map' || tabId === 'settings' || tabId === 'privacy' || tabId === 'safety') return true;
    if (tabId === 'dashboard') return role === 'staff' || role === 'admin' || role === 'superadmin';
    if (tabId === 'personnel' || tabId === 'admin') return role === 'admin' || role === 'superadmin';
    return false;
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-in fade-in zoom-in-95 duration-700">
        <ErrorBoundary>
          {(activeTab === 'sos' && canAccess('sos')) && <GuestSOS />}
          {(activeTab === 'safety' && canAccess('safety')) && <SafetyMode />}
          {(activeTab === 'dashboard' && canAccess('dashboard')) && <StaffDashboard />}
          {(activeTab === 'personnel' && canAccess('personnel')) && <PersonnelManagement />}
          {(activeTab === 'admin' && canAccess('admin')) && <AdminPanel />}
          {(activeTab === 'map' && canAccess('map')) && <VenueMap />}
          {(activeTab === 'privacy' && canAccess('privacy')) && <PrivacyDashboard />}
          {(activeTab === 'settings' && canAccess('settings')) && <Settings />}
        </ErrorBoundary>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <TacticalProvider>
            <AppContent />
          </TacticalProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

