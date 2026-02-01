'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeChats: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;

    let mounted = true;

    async function load() {
      try {
        const token = await getToken();
        
        // Get user data to find companyId
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const userData = await userRes.json();
        const companyId = userData.companyId;

        const [calls, chats] = await Promise.all([
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/calls/${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/whatsapp/chats/${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
]);

        if (!mounted) return;

        const c = await calls.json();
        const w = await chats.json();

        setStats({
          totalCalls: Array.isArray(c) ? c.length : 0,
          activeChats: Array.isArray(w) ? w.length : 0,
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false };
  }, [isSignedIn, getToken]);

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">
        Dashboard - {user?.firstName || 'Usuário'}
      </h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-gray-500 text-sm mb-2">Total de Chamadas</h2>
          <p className="text-3xl font-bold">{stats.totalCalls}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-gray-500 text-sm mb-2">Chats Ativos</h2>
          <p className="text-3xl font-bold">{stats.activeChats}</p>
        </div>
      </div>
    </div>
  );
}