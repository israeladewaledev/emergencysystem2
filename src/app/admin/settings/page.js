"use client";
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import SystemAnalyticsDashboard from '@/components/SystemAnalyticsDashboard';

const AdminSettingsPage = () => {
  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav title="Network Configuration" />
        <div className="flex-1 overflow-hidden">
          <SystemAnalyticsDashboard isNested={true} initialView="config" />
        </div>
      </main>
    </div>
  );
};

export default AdminSettingsPage;
