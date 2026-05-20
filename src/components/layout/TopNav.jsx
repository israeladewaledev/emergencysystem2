"use client";
import React from 'react';
import { ShieldAlert, Bell, User } from 'lucide-react';

const TopNav = ({ title, loading }) => {
  return (
    <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-black tracking-tight capitalize">{title || 'Dashboard'}</h2>
      </div>
      <div className="flex items-center gap-6">
        {loading && (
          <div className="flex items-center gap-2">
            <div className="size-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing Live Data...</span>
          </div>
        )}
        
        <div className="flex items-center gap-4 border-l border-gray-100 pl-6 text-gray-400">
          <button className="relative hover:text-gray-900 transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 size-4 bg-red-500 border-2 border-white rounded-full text-[8px] font-black text-white flex items-center justify-center">3</span>
          </button>
          <button className="size-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-all text-gray-600">
            <User size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
