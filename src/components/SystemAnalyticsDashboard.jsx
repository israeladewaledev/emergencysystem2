"use client";
import React from 'react';
import {
  TrendingUp,
  Timer,
  Server,
  Calendar,
  MoreVertical,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Activity,
  History,
  PieChart,
  Bell,
  Settings,
  ShieldAlert,
  ArrowDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SystemAnalyticsDashboard = ({ isNested = false, initialView = 'performance' }) => {
  const [currentView, setCurrentView] = useState(initialView);
  const [alerts, setAlerts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    avgResponse: "00:00",
    categories: { critical: 0, high: 0, medium: 0 },
    weeklyTrends: [0, 0, 0, 0, 0, 0, 0],
    hotspots: []
  });

  useEffect(() => {
    fetchData();
    
    // Realtime listener for analytics/feed updates
    const channel = supabase
      .channel('admin-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, () => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: alertData, error: alertError } = await supabase
      .from('emergency_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!alertError && alertData) {
      // Fetch profiles to map names
      const userIds = [...new Set(alertData.map(a => a.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profileData) {
          setProfiles(Object.fromEntries(profileData.map(p => [p.id, p])));
        }
      }

      setAlerts(alertData);
      
      const total = alertData.length;
      const handledAlerts = alertData.filter(d => d.accepted_at != null);

      // Avg Response
      let avgResponse = "00:00";
      if (handledAlerts.length > 0) {
        const totalMs = handledAlerts.reduce((acc, curr) => acc + (new Date(curr.accepted_at) - new Date(curr.created_at)), 0);
        const avgSecs = Math.floor((totalMs / handledAlerts.length) / 1000);
        const mins = Math.floor(avgSecs / 60);
        const secs = avgSecs % 60;
        avgResponse = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      // Weekly Trends
      const weeklyAlerts = new Array(7).fill(0);
      alertData.forEach(alert => {
        const day = new Date(alert.created_at).getDay();
        weeklyAlerts[day]++;
      });

      // Severity Distribution
      const criticalCount = alertData.filter(d => d.severity === 'Critical').length;
      const highCount = alertData.filter(d => d.severity === 'High').length;
      const mediumCount = alertData.filter(d => d.severity === 'Medium' || d.severity === 'Low').length;

      // Hotspots (Group by location)
      const locationMap = {};
      alertData.forEach(a => {
        const loc = a.location || 'Nile Campus';
        if (!locationMap[loc]) locationMap[loc] = { name: loc, count: 0, severitySum: 0 };
        locationMap[loc].count++;
        if (a.severity === 'Critical') locationMap[loc].severitySum += 3;
        else if (a.severity === 'High') locationMap[loc].severitySum += 2;
        else locationMap[loc].severitySum += 1;
      });

      const hotspots = Object.values(locationMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(h => ({
          ...h,
          risk: h.severitySum / h.count > 2 ? 'Critical Zone' : h.severitySum / h.count > 1 ? 'High Traffic' : 'Stable',
          color: h.severitySum / h.count > 2 ? 'red' : h.severitySum / h.count > 1 ? 'orange' : 'green'
        }));

      setStats({
        total,
        accepted: handledAlerts.length,
        avgResponse,
        weeklyTrends: weeklyAlerts,
        categories: {
          critical: total > 0 ? Math.round((criticalCount / total) * 100) : 0,
          high: total > 0 ? Math.round((highCount / total) * 100) : 0,
          medium: total > 0 ? Math.round((mediumCount / total) * 100) : 0
        },
        hotspots
      });
    }
    setLoading(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add Header
    doc.setFontSize(22);
    doc.text('NILE EMERGENCY SYSTEM - INCIDENT REPORT', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    // Add Table
    const tableColumn = ["Date", "Time", "Reporter", "Category", "Severity", "Location", "Status"];
    const tableRows = alerts.map(alert => [
      new Date(alert.created_at).toLocaleDateString(),
      new Date(alert.created_at).toLocaleTimeString(),
      profiles[alert.user_id]?.full_name || 'Anonymous',
      alert.category || 'N/A',
      alert.severity || 'N/A',
      alert.location || 'Nile Campus',
      (alert.status || 'pending').toUpperCase()
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [228, 66, 58], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    doc.save(`Nile_Emergency_Log_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'feed':
        return (
          <div className="flex-1 overflow-y-auto p-10 space-y-6">
            <h3 className="text-2xl font-black tracking-tight">Real-time Emergency Feed</h3>
            <div className="grid gap-4">
              {alerts.length > 0 ? alerts.slice(0, 10).map(alert => (
                <div key={alert.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`size-12 rounded-2xl flex items-center justify-center font-black text-white ${
                      alert.severity === 'Critical' ? 'bg-red-500' : alert.severity === 'High' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {alert.severity?.[0] || 'E'}
                    </div>
                    <div>
                      <p className="font-black text-lg">{alert.category || 'Medical Alert'}</p>
                      <p className="text-sm font-bold text-gray-400">Reporter: {profiles[alert.user_id]?.full_name || 'Anonymous'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{new Date(alert.created_at).toLocaleTimeString()}</p>
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                      alert.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {alert.status || 'pending'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest bg-white rounded-3xl border border-dashed border-gray-200">
                  No active incidents in the feed
                </div>
              )}
            </div>
          </div>
        );
      case 'history':
        return (
          <div className="flex-1 overflow-y-auto p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight">Full Incident Log Archive</h3>
              <button 
                onClick={exportToPDF}
                className="px-6 py-3 bg-[#e4423a] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <ArrowDown size={14} className="rotate-180" />
                Export PDF
              </button>
            </div>
            <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-soft">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reporter</th>
                    <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Category</th>
                    <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {alerts.length > 0 ? alerts.map(alert => (
                    <tr key={alert.id} className="hover:bg-gray-50/50">
                      <td className="px-10 py-5 font-mono text-xs font-bold text-gray-500">{new Date(alert.created_at).toLocaleDateString()}</td>
                      <td className="px-10 py-5 font-black text-sm">{profiles[alert.user_id]?.full_name || 'Anonymous'}</td>
                      <td className="px-10 py-5 text-center"><span className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-lg">{alert.category}</span></td>
                      <td className="px-10 py-5 text-right font-black text-[10px] uppercase text-green-600">{alert.status || 'pending'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="px-10 py-20 text-center text-gray-400 font-bold uppercase tracking-widest">No history recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'config':
        return (
          <div className="flex-1 overflow-y-auto p-10 space-y-10">
            <h3 className="text-2xl font-black tracking-tight">Network Configuration</h3>
            <div className="max-w-2xl bg-white p-10 rounded-[40px] border border-gray-100 shadow-soft space-y-8">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">System Thresholds</h4>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-900">Auto-Escalation</p>
                      <p className="text-xs font-bold text-gray-400">Escalate High severity alerts after 2 mins</p>
                    </div>
                    <div className="size-12 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-center text-green-600 font-black">ON</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-900">SMS Broadcast</p>
                      <p className="text-xs font-bold text-gray-400">Send secondary SMS for Critical events</p>
                    </div>
                    <div className="size-12 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400 font-black">OFF</div>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-gray-50">
                <button className="w-full py-4 bg-[#e4423a] text-white rounded-2xl font-black tracking-widest text-xs uppercase shadow-lg shadow-red-200">Save Configuration</button>
              </div>
            </div>
          </div>
        );
      case 'performance':
      default:
        return (
          <div className="flex-1 overflow-y-auto p-10 space-y-10">
            {/* Metric Grid */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-8 bg-white rounded-[40px] p-10 border border-gray-100 shadow-soft flex flex-col">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Emergency Signals</p>
                    <h3 className="text-6xl font-black tracking-tighter text-gray-900">{stats.total}</h3>
                  </div>
                  <div className="px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-[10px] font-black border border-red-100 flex items-center gap-1">
                    <TrendingUp size={12} />
                    +12% TREND
                  </div>
                </div>
                <p className="text-xs text-gray-400 font-bold mb-10">Live data synchronization active • vs 127 last week</p>

                {/* Chart Placeholder */}
                <div className="flex-1 bg-gray-50 rounded-3xl p-8 border border-gray-100 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Daily Incident Volume</h4>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-[#e4423a]" />
                        <span className="text-[10px] font-black text-gray-400 uppercase">Current</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-gray-300" />
                        <span className="text-[10px] font-black text-gray-400 uppercase">Baseline</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-end justify-between gap-4 px-2">
                    {stats.weeklyTrends.map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-4 group">
                        <div
                          className="w-full bg-[#e4423a] rounded-t-xl transition-all duration-500 shadow-lg shadow-red-200 group-hover:bg-red-700"
                          style={{ height: `${(val / (Math.max(...stats.weeklyTrends) || 1)) * 100}%`, minHeight: '10%' }}
                        />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][idx]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
                <MetricCard
                  label="Avg Response"
                  value={stats.avgResponse}
                  sub="30s BETTER"
                  icon={<Timer size={24} className="text-blue-600" />}
                  color="blue"
                  trend="down"
                />
                <MetricCard
                  label="System Uptime"
                  value="99.9%"
                  sub="STABLE"
                  icon={<Server size={24} className="text-green-600" />}
                  color="green"
                  trend="up"
                />
              </div>
            </div>

            {/* Distribution & Locations */}
            <div className="grid grid-cols-12 gap-8 pb-10">
              <div className="col-span-12 lg:col-span-4 bg-white rounded-[40px] p-10 border border-gray-100 shadow-soft">
                <h4 className="text-lg font-black tracking-tight mb-2">Priority Balance</h4>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-10">Severity Breakdown</p>

                <div className="space-y-8">
                  <ProgressItem label="Critical" value={stats.categories.critical} color="#e4423a" />
                  <ProgressItem label="Urgent" value={stats.categories.high} color="#FF9800" />
                  <ProgressItem label="Non-Urgent" value={stats.categories.medium} color="#1976D2" />
                </div>
              </div>

              <div className="col-span-12 lg:col-span-8 bg-white rounded-[40px] border border-gray-100 shadow-soft overflow-hidden">
                <div className="p-10 border-b border-gray-50 flex justify-between items-center">
                  <h4 className="text-lg font-black tracking-tight">Active Hotspots</h4>
                  <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline transition-all">Full Heatmap</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sector</th>
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Incidents</th>
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.hotspots.length > 0 ? (
                        stats.hotspots.map((spot, i) => (
                          <LocationRow 
                            key={i}
                            name={spot.name} 
                            block="Campus Sector" 
                            count={spot.count.toString()} 
                            risk={spot.risk} 
                            color={spot.color} 
                          />
                        ))
                      ) : (
                        <tr className="text-center text-gray-400 py-10">
                          <td colSpan="3" className="py-10 text-xs font-bold uppercase tracking-widest">No hotspot data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f5f5] text-slate-900">
      {/* Sidebar - Hide if nested */}
      {!isNested && (
        <aside className="w-80 bg-white border-r border-gray-100 flex flex-col z-30 shadow-sm">
          <div className="p-8 border-b border-gray-50 flex items-center gap-4">
            <div className="size-12 bg-[#e4423a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="font-black text-[#e4423a] text-lg tracking-tighter uppercase leading-none">Nile Univ.</h1>
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Admin</p>
            </div>
          </div>
          <nav className="flex-1 p-6 space-y-2">
            <NavItem 
              icon={<Activity />} 
              label="Incident Feed" 
              active={currentView === 'feed'} 
              onClick={() => setCurrentView('feed')} 
            />
            <NavItem 
              icon={<History />} 
              label="Log History" 
              active={currentView === 'history'} 
              onClick={() => setCurrentView('history')} 
            />
            <NavItem 
              icon={<PieChart />} 
              label="Performance" 
              active={currentView === 'performance'} 
              onClick={() => setCurrentView('performance')} 
            />
            <div className="pt-6 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Management</div>
            <NavItem 
              icon={<Settings />} 
              label="Network Config" 
              active={currentView === 'config'} 
              onClick={() => setCurrentView('config')} 
            />
          </nav>
        </aside>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!isNested && (
          <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black tracking-tight capitalize">{currentView.replace('-', ' ')}</h2>
            </div>
            <div className="flex items-center gap-4">
              {loading && <div className="text-xs font-black text-gray-400 animate-pulse uppercase tracking-widest">Syncing Live Data...</div>}
              <button 
                onClick={fetchData}
                className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all"
              >
                Refresh
              </button>
            </div>
          </header>
        )}

        {renderContent()}
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${active
      ? 'bg-[#e4423a] text-white font-black shadow-lg shadow-red-200'
      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
    }`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}
    </div>
    <span className="text-xs font-bold tracking-tight">{label}</span>
  </button>
);

const MetricCard = ({ label, value, sub, icon, color, trend }) => (
  <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-soft flex flex-col justify-between transition-all hover:-translate-y-1">
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl ${color === 'blue' ? 'bg-blue-50' : 'bg-green-50'}`}>
        {icon}
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
        {trend === 'up' ? <TrendingUp size={12} /> : <ArrowDown size={12} />}
        {sub}
      </div>
    </div>
    <div>
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{label}</h4>
      <p className="text-4xl font-black text-gray-900 tracking-tight">{value}</p>
    </div>
  </div>
);

const ProgressItem = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between items-end mb-3">
      <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-gray-400">{value}%</span>
    </div>
    <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  </div>
);

const LocationRow = ({ name, block, count, risk, color }) => (
  <tr className="hover:bg-gray-50/50 transition-all">
    <td className="px-10 py-6">
      <div className="flex items-center gap-4">
        <div className={`size-10 rounded-xl flex items-center justify-center font-black text-xs ${color === 'red' ? 'bg-red-50 text-red-600' : color === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
          }`}>
          <MapPin size={16} />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">{name}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{block}</p>
        </div>
      </div>
    </td>
    <td className="px-10 py-6 text-center font-black text-lg text-gray-900">{count}</td>
    <td className="px-10 py-6 text-right">
      <span className={`text-[10px] font-black uppercase tracking-widest ${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-green-600'
        }`}>{risk}</span>
    </td>
  </tr>
);

export default SystemAnalyticsDashboard;
