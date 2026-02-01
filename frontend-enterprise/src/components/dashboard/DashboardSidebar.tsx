'use client';

import Link from 'next/link';

export function DashboardSidebar() {
  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: '64px',
      width: '256px',
      height: 'calc(100vh - 64px)',
      backgroundColor: 'white',
      borderRight: '1px solid #e5e7eb',
      padding: '16px'
    }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>AI Sales</div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>Assistant</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Link href="/dashboard" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: '#dbeafe',
          color: '#2563eb',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Dashboard
        </Link>

        <Link href="/dashboard/calls" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Ligações
        </Link>

        <Link href="/dashboard/whatsapp" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          WhatsApp
        </Link>

        <Link href="/dashboard/analytics" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Analytics
        </Link>

        <Link href="/dashboard/team" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Equipe
        </Link>

        <Link href="/dashboard/billing" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Cobrança
        </Link>

        <Link href="/dashboard/settings" style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#374151',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Configurações
        </Link>
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: '#2563eb',
        color: 'white'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Upgrade para Pro</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>Recursos ilimitados</div>
        <button style={{
          marginTop: '12px',
          width: '100%',
          padding: '8px',
          borderRadius: '6px',
          backgroundColor: 'white',
          color: '#2563eb',
          border: 'none',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          Ver Planos
        </button>
      </div>
    </div>
  );
}