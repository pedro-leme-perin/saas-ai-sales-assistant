'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

export interface Plan {
  name: string;
  plan: string; // STARTER | PROFESSIONAL | ENTERPRISE
  price: number;
  currency: string;
  features: string[];
  limits: { users: number; callsPerMonth: number; chatsPerMonth: number };
  isPopular?: boolean;
}

export interface Subscription {
  subscription: any | null;
  plan: Plan | null;
  company: {
    plan: string;
    limits: any;
  };
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
  stripeInvoiceId?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useBilling() {
  const { getToken } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authFetch = useCallback(async (path: string, options?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subData, plansData, invoicesData] = await Promise.all([
        authFetch('/api/billing/subscription').catch(() => null),
        authFetch('/api/billing/plans').catch(() => []),
        authFetch('/api/billing/invoices').catch(() => []),
      ]);
      setSubscription(subData);
      // Mark Professional as popular
      const enriched = (plansData || []).map((p: Plan) => ({
        ...p,
        isPopular: p.plan === 'PROFESSIONAL',
      }));
      setPlans(enriched);
      setInvoices(invoicesData || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startCheckout = useCallback(async (plan: string) => {
    try {
      const data = await authFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        }),
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to generate checkout URL. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start checkout. Please try again.';
      setError(errorMessage);
    }
  }, [authFetch]);

  const openPortal = useCallback(async () => {
    const data = await authFetch('/api/billing/portal');
    if (data.url) window.location.href = data.url;
  }, [authFetch]);

  const changePlan = useCallback(async (plan: string) => {
    await authFetch('/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    await load();
  }, [authFetch, load]);

  const cancelSubscription = useCallback(async () => {
    await authFetch('/api/billing/cancel', { method: 'POST' });
    await load();
  }, [authFetch, load]);

  return {
    subscription,
    plans,
    invoices,
    loading,
    error,
    currentPlan: subscription?.company?.plan || 'STARTER',
    startCheckout,
    openPortal,
    changePlan,
    cancelSubscription,
    reload: load,
  };
}