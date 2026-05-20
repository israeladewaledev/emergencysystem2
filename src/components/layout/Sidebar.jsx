"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShieldAlert, 
  Activity, 
  History, 
  PieChart, 
  Settings, 
  Bell,
  LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { icon: <Activity />, label: "Incident Feed", href: "/admin/feed" },
    { icon: <History />, label: "Incident History", href: "/admin/history" },
    { icon: <PieChart />, label: "System Analytics", href: "/admin/analytics" },
    { icon: <Settings />, label: "Network Config", href: "/admin/settings" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <aside className="w-80 bg-white border-r border-gray-100 flex flex-col z-30 shadow-sm">
      <div className="p-8 border-b border-gray-50 flex items-center gap-4">
        <div className="size-12 bg-[#e4423a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h1 className="font-black text-[#e4423a] text-lg tracking-tighter uppercase leading-none">Nile Univ.</h1>
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Admin Portal</p>
        </div>
      </div>

      <nav className="flex-1 p-6 space-y-2">
        {navItems.map((item) => (
          <Link 
            key={item.href} 
            href={item.href}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${
              pathname === item.href
                ? 'bg-[#e4423a] text-white font-black shadow-lg shadow-red-200'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className={`transition-transform duration-300 ${pathname === item.href ? 'scale-110' : 'group-hover:scale-110'}`}>
              {React.cloneElement(item.icon, { size: 18, strokeWidth: pathname === item.href ? 3 : 2 })}
            </div>
            <span className="text-xs font-bold tracking-tight">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-6 border-t border-gray-50">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all group"
        >
          <LogOut size={18} className="group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
