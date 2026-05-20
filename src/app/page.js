"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldAlert } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/admin/feed');
      } else {
        // In a real app, redirect to login. 
        // For this demo/development state, we'll auto-redirect to feed
        // as the auth might be handled by middleware or within the pages.
        router.push('/admin/feed');
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="size-20 bg-[#e4423a] rounded-[32px] flex items-center justify-center text-white shadow-xl shadow-red-200">
          <ShieldAlert size={40} />
        </div>
        <div className="text-center">
          <h1 className="font-black text-2xl tracking-tighter uppercase text-gray-900">Initializing Portal</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Connecting to Secure Emergency Network</p>
        </div>
      </div>
    </div>
  );
}
