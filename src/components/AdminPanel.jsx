"use client";
import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

const ROLES = ['reporter', 'responder', 'admin'];

const ROLE_COLORS = {
  admin: 'bg-red-50 text-red-600 border-red-100',
  responder: 'bg-blue-50 text-blue-600 border-blue-100',
  reporter: 'bg-gray-50 text-gray-500 border-gray-100',
};

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audit'
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchAuditLog();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, blood_group, role, updated_at')
      .order('updated_at', { ascending: false });

    if (!error) setUsers(data || []);
    setLoading(false);
  };

  const fetchAuditLog = async () => {
    const { data, error } = await supabase
      .from('emergency_alerts')
      .select('id, user_id, category, severity, status, created_at, accepted_at, override_by, override_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Batch fetch profile names separately to avoid FK ambiguity
      const userIds = [...new Set(data.map(a => a.user_id).filter(Boolean))];
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profileData) profileMap = Object.fromEntries(profileData.map(p => [p.id, p]));
      }
      setAuditLog(data.map(d => ({ ...d, profiles: profileMap[d.user_id] || null })));
      return;
    }

    if (!error) setAuditLog(data || []);
  };

  const updateRole = async (userId, newRole) => {
    setUpdatingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setUpdatingId(null);
  };

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.student_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">User Management</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            {users.length} registered accounts
          </p>
        </div>
        <button
          onClick={() => { fetchUsers(); fetchAuditLog(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
        {['users', 'audit'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'users' ? <><Users size={12} className="inline mr-2" />Users</> : <><ShieldCheck size={12} className="inline mr-2" />Audit Log</>}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or university ID..."
              className="w-full bg-white border border-gray-100 rounded-2xl pl-10 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500/10 outline-none shadow-sm"
            />
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-soft overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">University ID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Blood Group</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Role</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-8 py-5">
                            <div className="h-4 bg-gray-100 rounded-full animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-all">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm">
                              {(user.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-black text-gray-900">{user.full_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-mono text-xs font-bold text-gray-500">{user.student_id || '—'}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs font-black">
                            {user.blood_group || 'N/A'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-3 py-1 border rounded-lg text-[10px] font-black uppercase tracking-widest ${ROLE_COLORS[user.role] || ROLE_COLORS.reporter}`}>
                            {user.role || 'reporter'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="relative inline-block">
                            <select
                              value={user.role || 'reporter'}
                              onChange={e => updateRole(user.id, e.target.value)}
                              disabled={updatingId === user.id}
                              className="appearance-none pl-4 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black cursor-pointer focus:ring-2 focus:ring-red-500/10 outline-none transition-all"
                            >
                              {ROLES.map(r => (
                                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-sm font-bold">No users found matching &quot;{search}&quot;</div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'audit' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-soft overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Incident</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reporter</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Severity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditLog.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-8 py-4">
                      <div>
                        <p className="text-sm font-black text-gray-900">{log.category || 'Emergency'}</p>
                        {log.override_by && (
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">⚠ Overridden</p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-gray-600">{log.profiles?.full_name || 'Anonymous'}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <SeverityBadge severity={log.severity} />
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${
                        log.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100'
                        : log.status === 'accepted' ? 'bg-blue-50 text-blue-600 border-blue-100'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="font-mono text-[10px] font-bold text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditLog.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-sm font-bold">No audit records yet.</div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

const SeverityBadge = ({ severity }) => {
  const map = {
    Critical: 'bg-red-50 text-red-600 border-red-100',
    High: 'bg-orange-50 text-orange-600 border-orange-100',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    Low: 'bg-green-50 text-green-600 border-green-100',
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${map[severity] || map.Low}`}>
      {severity || 'Unknown'}
    </span>
  );
};

export default AdminPanel;
