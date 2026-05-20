"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import ResponderDashboard from '@/components/ResponderDashboard';

const AdminFeedPage = () => {
  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav title="Emergency Incident Feed" />
        <div className="flex-1 overflow-hidden">
          <ResponderDashboard isNested={true} />
        </div>
      </main>
    </div>
  );
};

export default AdminFeedPage;
