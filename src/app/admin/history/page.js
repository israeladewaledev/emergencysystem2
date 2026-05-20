"use client";
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import SystemAnalyticsDashboard from '@/components/SystemAnalyticsDashboard';

const AdminHistoryPage = () => {
  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav title="Incident Log History" />
        <div className="flex-1 overflow-hidden">
          <SystemAnalyticsDashboard isNested={true} initialView="history" />
        </div>
      </main>
    </div>
  );
};

export default AdminHistoryPage;
