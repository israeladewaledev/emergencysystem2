"use client";
import React, { useState, useEffect } from 'react';
import {
  Bell,
  Search,
  MapPin,
  Activity,
  ShieldAlert,
  History,
  PieChart,
  Settings,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Video,
  Send,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Stethoscope,
  ChevronRight,
  Users,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import dynamic from 'next/dynamic';
import AdminPanel from './AdminPanel';

// --- Helpers ---

/** Register service worker and request Notification permission */
async function registerSW() {
  if ('serviceWorker' in navigator && 'Notification' in window) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }
}

/** Show a system notification via the service worker */
async function showAlertNotification(alert) {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({
    type: 'SHOW_NOTIFICATION',
    title: `New SOS — ${alert.type}`,
    body: `${alert.patient} at ${alert.location}`,
    severity: alert.severity,
  });
}

/** Convert lat/lng to a human-readable label via Nominatim */
async function geocodeToLabel(lat, lng) {
  if (!lat || !lng) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    // Prefer road + suburb, fall back to display_name
    const parts = [data.address?.road, data.address?.suburb, data.address?.city].filter(Boolean);
    return parts.length ? parts.join(', ') : data.display_name?.split(',')[0];
  } catch {
    return null;
  }
}

/** Severity colour map for 4-tier MTS */
const SEVERITY_STYLES = {
  Critical: 'bg-red-50 text-red-600 border-red-100',
  High:     'bg-orange-50 text-orange-600 border-orange-100',
  Medium:   'bg-yellow-50 text-yellow-700 border-yellow-100',
  Low:      'bg-green-50 text-green-600 border-green-100',
};
const SEVERITY_ICON = {
  Critical: Flame,
  High:     AlertTriangle,
  Medium:   AlertTriangle,
  Low:      CheckCircle,
};

// Dynamically import LiveMap with SSR disabled to fix "window is not defined"
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading Map</span>
      </div>
    </div>
  )
});

const ResponderDashboard = ({ isNested = false }) => {
  const [activeAlert, setActiveAlert] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('alerts'); // 'alerts', 'history', 'analytics', 'admin'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [stats, setStats] = useState({ total: 0, handled: 0, avgTime: "N/A" });
  const [onDuty, setOnDuty] = useState(true);
  const [overrideSeverity, setOverrideSeverity] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [userRole, setUserRole] = useState('responder');
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    registerSW();
    fetchUserRole();
    fetchAlerts();

    const channel = supabase
      .channel('emergency_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, (payload) => {
        fetchAlerts();
        
        // Fire desktop notification for new SOS
        if (payload.eventType === 'INSERT') {
          showAlertNotification({
            type: payload.new.category || 'Emergency',
            patient: 'New SOS Triggered',
            location: payload.new.location || 'Nile Campus',
            severity: payload.new.severity || 'High',
          });
        }

        // If an update comes for our active alert, sync it
        if (activeAlert && payload.new.id === activeAlert.realId) {
          const updated = {
            id: `SOS-${payload.new.id.slice(0, 8)}`,
            realId: payload.new.id,
            user_id: payload.new.user_id,
            status: payload.new.status,
            severity: payload.new.severity,
            category: payload.new.category,
            location: payload.new.location,
            latitude: payload.new.latitude,
            longitude: payload.new.longitude,
            created_at: payload.new.created_at,
            accepted_at: payload.new.accepted_at,
            type: payload.new.category,
            patient: profiles[payload.new.user_id]?.full_name || 'Reporter',
            score: payload.new.severity === 'Critical' ? 95 : payload.new.severity === 'High' ? 75 : 45,
            time: new Date(payload.new.created_at).toLocaleTimeString()
          };
          setActiveAlert(updated);
        }
      })
      .subscribe();

    // Check for an active (accepted or on_site) alert on mount
    const checkActive = async () => {
      const { data } = await supabase
        .from('emergency_alerts')
        .select('*')
        .in('status', ['accepted', 'on_site'])
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        // Need profiles to map patient name correctly
        const { data: pData } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
        const alertObj = {
          id: `SOS-${data.id.slice(0, 8)}`,
          realId: data.id,
          user_id: data.user_id,
          status: data.status,
          severity: data.severity,
          category: data.category,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          created_at: data.created_at,
          accepted_at: data.accepted_at,
          type: data.category,
          patient: pData?.full_name || 'Reporter',
          score: data.severity === 'Critical' ? 95 : data.severity === 'High' ? 75 : 45,
          time: new Date(data.created_at).toLocaleTimeString()
        };
        setActiveAlert(alertObj);
      }
    };
    checkActive();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (activeAlert) {
      fetchMessages(activeAlert.realId);
      const messageChannel = supabase
        .channel(`messages-${activeAlert.realId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'emergency_messages', filter: `alert_id=eq.${activeAlert.realId}` },
          (payload) => {
            setMessages(prev => [...prev, payload.new]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messageChannel);
      };
    } else {
      setMessages([]);
    }
  }, [activeAlert]);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role) setUserRole(data.role);
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);

      // Step 1: Fetch alerts with no embed (avoids FK ambiguity)
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Step 2: Batch-fetch profiles for all unique user_ids
      const userIds = [...new Set(data.map(a => a.user_id).filter(Boolean))];
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, student_id, blood_group, allergies')
          .in('id', userIds);
        if (profileData) {
          profileMap = Object.fromEntries(profileData.map(p => [p.id, p]));
        }
      }

      // Step 3: Geocode and merge
      const geocodedAlerts = await Promise.all(
        data.map(async (alert) => {
          const profile = profileMap[alert.user_id] || null;
          let geoLabel = alert.location || 'Nile Campus';
          if (alert.latitude && alert.longitude && !alert.location) {
            const label = await geocodeToLabel(alert.latitude, alert.longitude);
            if (label) geoLabel = label;
          }
          const severityScore = { Critical: 95, High: 80, Medium: 60, Low: 40 };
          return {
            id: `#${alert.id.toString().slice(-4)}`,
            realId: alert.id,
            status: alert.status,
            patient: profile?.full_name || 'Anonymous User',
            type: alert.category || 'Emergency',
            severity: alert.severity || 'High',
            score: severityScore[alert.severity] || 75,
            eta: alert.status === 'accepted' ? 'Rendezvous in 4m' : 'Calculating...',
            location: geoLabel,
            rawLocation: { latitude: alert.latitude, longitude: alert.longitude },
            time: new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            patientData: profile,
            rawDate: alert.created_at,
            overrideBy: alert.override_by,
          };
        })
      );

      setAlerts(geocodedAlerts);

      const handled = data.filter(d => d.accepted_at != null);
      let avg = "N/A";
      if (handled.length > 0) {
        const totalMs = handled.reduce((acc, curr) => acc + (new Date(curr.accepted_at) - new Date(curr.created_at)), 0);
        avg = `${((totalMs / handled.length) / 60000).toFixed(1)}m`;
      }
      setStats({ total: data.length, handled: handled.length, avgTime: avg });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alerts:', err.message);
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!activeAlert || !overrideSeverity) return;
    setOverriding(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('emergency_alerts')
      .update({
        severity: overrideSeverity,
        override_by: user?.id,
        override_at: new Date().toISOString(),
      })
      .eq('id', activeAlert.realId);
    if (!error) {
      setActiveAlert(prev => ({ ...prev, severity: overrideSeverity }));
      await fetchAlerts();
    }
    setOverriding(false);
    setOverrideSeverity('');
  };

  const fetchMessages = async (alertId) => {
    const { data, error } = await supabase
      .from('emergency_messages')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: true });

    if (!error) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeAlert) return;

    const { error } = await supabase
      .from('emergency_messages')
      .insert({
        alert_id: activeAlert.realId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        content: newMessage
      });

    if (!error) setNewMessage("");
  };

  const handleAcceptAlert = async (alertId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('emergency_alerts')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          responder_id: user?.id
        })
        .eq('id', alertId);

      if (error) throw error;

      // Find the alert and set it as active
      const alert = alerts.find(a => a.realId === alertId);
      if (alert) {
        setActiveAlert({ ...alert, status: 'accepted', responder_id: user?.id });
      }
    } catch (error) {
      console.error('Error accepting alert:', error);
      alert('Failed to dispatch: ' + error.message);
    }
  };

  const handleMarkArrived = async (alertId) => {
    try {
      const { error } = await supabase
        .from('emergency_alerts')
        .update({
          status: 'on_site',
          arrived_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      if (activeAlert?.realId === alertId) {
        setActiveAlert({ ...activeAlert, status: 'on_site', arrived_at: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error marking arrived:', error);
    }
  };

  const startVideoCall = async () => {
    if (!activeAlert) return;
    const roomName = `NileEmergency-${activeAlert.realId.slice(0, 8)}`;
    const meetUrl = `https://meet.jit.si/${roomName}`;

    const { error } = await supabase
      .from('emergency_messages')
      .insert({
        alert_id: activeAlert.realId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        content: `---VIDEO_CALL_LINK---${meetUrl}`
      });

    if (error) {
      console.error('Error starting video call:', error.message);
    } else {
      window.open(meetUrl, '_blank');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error.message);
    window.location.reload(); // Refresh to trigger auth check in parent or clear state
  };

  const [severityFilter, setSeverityFilter] = useState('All');

  const activeAlerts = alerts
    .filter(a => a.status === 'pending' || a.status === 'accepted' || a.status === 'on_site')
    .filter(a => severityFilter === 'All' || a.severity === severityFilter);
  const historyAlerts = alerts.filter(a => a.status === 'resolved' || a.status === 'cancelled');

  return (
    <div className="flex h-screen bg-[#f5f5f5] text-[#171211]">
      {/* Sidebar */}
      {!isNested && (
        <aside className="w-80 bg-white border-r border-gray-100 flex flex-col z-30 shadow-sm">
          <div className="p-8 border-b border-gray-50 flex items-center gap-4">
            <div className="size-12 bg-[#e4423a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="font-black text-[#e4423a] text-lg tracking-tighter uppercase leading-none">Nile Univ.</h1>
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Responder</p>
            </div>
          </div>

          <nav className="flex-1 p-6 space-y-2">
            <NavItem
              icon={<Activity />}
              label="Active Response"
              active={currentView === 'alerts'}
              onClick={() => setCurrentView('alerts')}
              count={activeAlerts.length}
            />
            <NavItem
              icon={<History />}
              label="Incident History"
              active={currentView === 'history'}
              onClick={() => setCurrentView('history')}
            />
            <NavItem
              icon={<PieChart />}
              label="System Analytics"
              active={currentView === 'analytics'}
              onClick={() => setCurrentView('analytics')}
            />
            <div className="pt-6 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">System</div>
            <NavItem
              icon={<Bell />}
              label="Alert Notifications"
              active={currentView === 'notifications'}
              onClick={() => setCurrentView('notifications')}
            />
            {userRole === 'admin' && (
              <NavItem
                icon={<Users />}
                label="User Management"
                active={currentView === 'admin'}
                onClick={() => setCurrentView('admin')}
              />
            )}
            <NavItem
              icon={<Settings />}
              label="Preferences"
              active={currentView === 'preferences'}
              onClick={() => setCurrentView('preferences')}
            />
          </nav>

          {/* User Card */}
          <div className="p-6 border-t border-gray-50 bg-gray-50/50">
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                    <img src="https://i.pravatar.cc/150?u=sarah" alt="Dr. Sarah" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 leading-none mb-1">Dr. Sarah A.</p>
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">On Duty</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                title="Logout"
              >
                <XCircle size={18} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-2 bg-red-500 rounded-full animate-ping" />
            <h2 className="font-black text-sm uppercase tracking-widest text-gray-500">Live Command Center</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase">Duty Status</span>
              <div
                onClick={() => setOnDuty(!onDuty)}
                className={`w-12 h-6 rounded-full cursor-pointer transition-all p-1 flex items-center ${onDuty ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}>
                <div className="size-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        < div className="flex-1 overflow-y-auto p-10" >
          {currentView === 'alerts' && (
            <div className="grid grid-cols-12 gap-10 h-full">
              {/* alerts List - col 5 */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black tracking-tight text-gray-900">Incident Queue</h3>
                  <div className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-lg border border-red-100 uppercase tracking-widest">
                    {activeAlerts.length} Signals
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map(f => (
                    <button
                      key={f}
                      onClick={() => setSeverityFilter(f)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        severityFilter === f
                          ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200'
                          : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {activeAlerts.map(alert => (
                  <motion.div
                    key={alert.realId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setActiveAlert(alert)}
                    className={`relative overflow-hidden rounded-3xl p-6 cursor-pointer border-2 transition-all duration-300 ${activeAlert?.realId === alert.realId
                      ? 'bg-white border-[#e4423a] shadow-xl shadow-red-500/5'
                      : 'bg-white border-transparent hover:border-gray-200 shadow-soft'
                      }`}
                  >
                    {(alert.severity === 'Critical' || alert.severity === 'High') && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 animate-pulse ${alert.severity === 'Critical' ? 'bg-[#e4423a]' : 'bg-orange-400'}`} />
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.Low}`}>
                        {React.createElement(SEVERITY_ICON[alert.severity] || AlertTriangle, { size: 12 })}
                        {alert.severity}
                      </div>
                      <span className="font-mono text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{alert.time}</span>
                    </div>
                    <h4 className="text-xl font-black text-gray-900 mb-1">{alert.type}</h4>
                    <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-6">Dispatch required at {alert.location}. Patient is {alert.patient}.</p>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                          <MapPin size={16} />
                        </div>
                        <span className="text-xs font-bold text-gray-600 truncate max-w-[120px]">{alert.location}</span>
                      </div>
                      
                      {alert.status === 'pending' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAcceptAlert(alert.realId); }}
                          className="px-6 py-2.5 bg-[#e4423a] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 active:scale-95 transition-all"
                        >
                          Dispatch
                        </button>
                      ) : alert.status === 'accepted' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkArrived(alert.realId); }}
                          className="px-6 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all"
                        >
                          Arrived at Scene
                        </button>
                      ) : (
                        <div className="px-4 py-2.5 bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest rounded-xl border border-green-100 flex items-center gap-2">
                          <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                          In Progress
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {activeAlerts.length === 0 && (
                  <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-200 opacity-60">
                    <CheckCircle2 className="mx-auto mb-4 text-green-400" size={48} />
                    <p className="font-black text-gray-400 tracking-tight">System All-Clear<br /><span className="text-xs">Monitoring live signals...</span></p>
                  </div>
                )}
              </div>

              {/* Detail Panel - col 7 */}
              <div className="col-span-12 lg:col-span-7">
                <AnimatePresence mode="wait">
                  {activeAlert ? (
                    <motion.div
                      key={activeAlert.realId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white rounded-[40px] shadow-xl shadow-gray-200/50 border border-gray-100 p-10 flex flex-col"
                    >
                      <div className="flex justify-between items-center mb-10">
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Signal Details</h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{activeAlert.id}</p>
                        </div>
                        <button onClick={() => setActiveAlert(null)} className="size-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                          <XCircle size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-10">
                        <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex items-center gap-5">
                          <div className="size-14 bg-red-100 text-[#e4423a] rounded-2xl flex items-center justify-center">
                            <ShieldAlert size={32} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[#e4423a] uppercase tracking-widest mb-1">Triage Score</p>
                            <h4 className="text-3xl font-black text-[#e4423a]">{activeAlert.score}/100</h4>
                            {activeAlert.overrideBy && (
                              <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-1">⚠ Manually Overridden</p>
                            )}
                          </div>
                        </div>
                        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center gap-5">
                          <div className="size-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Navigation size={32} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Estimated ETA</p>
                            <h4 className="text-3xl font-black text-blue-600">~2 Min</h4>
                          </div>
                        </div>
                      </div>

                      {/* Live Map Tracking */}
                      <div className="bg-white rounded-[32px] p-2 border border-blue-100 shadow-xl shadow-blue-500/5 overflow-hidden h-64 mb-8 relative group">
                        <LiveMap
                          latitude={activeAlert.rawLocation?.latitude}
                          longitude={activeAlert.rawLocation?.longitude}
                          label={`${activeAlert.patient}'s Location`}
                        />
                        <div className="absolute top-6 left-6 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-blue-100 shadow-sm flex items-center gap-2">
                          <div className="size-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Live Tracking</span>
                        </div>
                      </div>

                      {/* Patient Info Card */}
                      <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-8 mb-10">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Involved Individual</h5>
                        <div className="flex items-center gap-6">
                          <div className="size-16 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center text-2xl font-black shadow-inner">
                            {activeAlert.patient.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-black text-gray-900 mb-1">{activeAlert.patient}</h4>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">ID: {activeAlert.patientData?.student_id || 'NOT_LOGGED'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-900 shadow-sm">{activeAlert.patientData?.blood_group || 'N/A'}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase">Blood Group</span>
                          </div>
                        </div>
                        <div className="mt-8 pt-8 border-t border-gray-100 flex items-center gap-4 text-orange-600">
                          <Stethoscope size={20} />
                          <span className="text-sm font-bold tracking-tight">Allergies: {activeAlert.patientData?.allergies || 'No known allergies'}</span>
                        </div>
                      </div>

                      {/* AI Triage Override */}
                      <div className="bg-orange-50 rounded-3xl border border-orange-100 p-6 mb-6">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <ShieldCheck size={12} /> Human-in-the-Loop Override
                        </p>
                        <div className="flex gap-3">
                          <select
                            value={overrideSeverity}
                            onChange={e => setOverrideSeverity(e.target.value)}
                            className="flex-1 bg-white border border-orange-100 rounded-xl px-4 py-3 text-xs font-black focus:ring-2 focus:ring-orange-300 outline-none"
                          >
                            <option value="">— Select Override Level —</option>
                            <option value="Critical">🔴 Critical — Immediate</option>
                            <option value="High">🟠 High — Very Urgent</option>
                            <option value="Medium">🟡 Medium — Urgent</option>
                            <option value="Low">🟢 Low — Non-Urgent</option>
                          </select>
                          <button
                            onClick={handleOverride}
                            disabled={!overrideSeverity || overriding}
                            className="px-6 py-3 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-all"
                          >
                            {overriding ? 'Saving...' : 'Confirm'}
                          </button>
                        </div>
                      </div>

                      {/* Chat & Telemedicine */}
                      <div className="h-[600px] flex flex-col bg-gray-50 rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
                        <div className="px-8 py-4 border-b border-gray-100 flex justify-between items-center bg-white/50 backdrop-blur-md">
                          <div className="flex items-center gap-3">
                            <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Medical Inquiry Chat</span>
                          </div>
                          <button onClick={startVideoCall} className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100 hover:bg-orange-100 transition-colors">
                            <Video size={16} />
                            Start Video
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                          {messages.map((msg, i) => {
                            const isMe = msg.sender_id === currentUserId;
                            return (
                              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm ${isMe
                                  ? 'bg-[#e4423a] text-white rounded-tr-none'
                                  : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                                  }`}>
                                  {msg.content}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>

                        <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
                          <input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type clinical instructions..."
                            className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500/10 outline-none"
                          />
                          <button
                            onClick={sendMessage}
                            className="size-14 bg-[#e4423a] text-white rounded-2xl flex items-center justify-center hover:bg-red-700 shadow-lg shadow-red-200 active:scale-95 transition-all"
                          >
                            <Send size={24} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-white rounded-[40px] border-4 border-dashed border-gray-100 h-full flex flex-col items-center justify-center text-gray-300 p-20 text-center">
                      <div className="p-10 bg-gray-50 rounded-full mb-8">
                        <Activity size={64} className="opacity-20 animate-pulse" />
                      </div>
                      <h3 className="text-2xl font-black text-gray-400 mb-2">Awaiting Signal Selection</h3>
                      <p className="text-sm font-bold max-w-xs leading-relaxed opacity-60">Select an active emergency alert from the queue to view metadata and begin responding.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {
            currentView === 'history' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">Incident Logs</h2>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Export PDF</button>
                    <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Filters</button>
                  </div>
                </div>
                <div className="space-y-4">
                  {historyAlerts.map(alert => (
                    <div key={alert.realId} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-soft flex justify-between items-center transition-transform hover:-translate-y-1">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl border ${alert.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                          }`}>
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-gray-900 mb-1">{alert.patient}</h4>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{alert.type} • {alert.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div>
                          <p className="text-xs font-black text-gray-900 mb-1">{new Date(alert.rawDate).toLocaleDateString()}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{alert.time}</p>
                        </div>
                        <ChevronRight className="text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          {
            currentView === 'admin' && (
              <AdminPanel />
            )
          }

          {
            currentView === 'notifications' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">System Notifications</h2>
                <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-soft text-center opacity-60">
                  <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="font-bold text-gray-400">All notifications are synced with your browser.<br/><span className="text-xs">Incoming SOS alerts will trigger a system-level popup.</span></p>
                </div>
              </div>
            )
          }

          {
            currentView === 'preferences' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Preferences</h2>
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-soft space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-900">Audio Alerts</p>
                      <p className="text-xs font-bold text-gray-400">Play sound when new SOS is received</p>
                    </div>
                    <div className="w-12 h-6 bg-red-500 rounded-full relative"><div className="absolute right-1 top-1 size-4 bg-white rounded-full shadow-sm" /></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-900">Dark Mode</p>
                      <p className="text-xs font-bold text-gray-400">Adopt system appearance</p>
                    </div>
                    <div className="w-12 h-6 bg-gray-200 rounded-full relative"><div className="absolute left-1 top-1 size-4 bg-white rounded-full shadow-sm" /></div>
                  </div>
                </div>
              </div>
            )
          }

          {
            currentView === 'analytics' && (
              <div className="max-w-6xl mx-auto space-y-12">
                <div className="bg-white p-20 rounded-[48px] border-4 border-dashed border-gray-100 text-center">
                  <PieChart size={64} className="mx-auto mb-6 text-blue-200" />
                  <h3 className="text-3xl font-black text-gray-400 mb-4">Detailed Analytics Available</h3>
                  <p className="text-gray-400 font-bold max-w-sm mx-auto mb-10">Use the "System Admin" tab at the top of the portal to access the full System Performance command center.</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200"
                  >
                    Switch to System Admin
                  </button>
                </div>
              </div>
            )
          }
        </div >
      </main >
    </div >
  );
};

const NavItem = ({ icon, label, active = false, onClick, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${active
      ? 'bg-[#e4423a] text-white font-black shadow-lg shadow-red-200'
      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
      }`}
  >
    <div className="flex items-center gap-4">
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}
      </div>
      <span className="text-xs font-bold tracking-tight">{label}</span>
    </div>
    {count !== undefined && count > 0 && (
      <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'bg-white text-red-600' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
        {count}
      </span>
    )}
  </button>
);

const StatCard = ({ label, value, color }) => (
  <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-soft">
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{label}</p>
    <p className={`text-6xl font-black tracking-tighter ${color === 'red' ? 'text-[#e4423a]' : color === 'blue' ? 'text-blue-600' : 'text-green-600'
      }`}>{value}</p>
  </div>
);

export default ResponderDashboard;
