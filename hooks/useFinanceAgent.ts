import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// FIX #2: Auth token comes from supabase.auth.getSession() — NEVER localStorage.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useFinanceAgent(businessId: string | string[]) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async ({ days = 30, userMessage = null }: { days?: number; userMessage?: string | null } = {}) => {
    if (!businessId) return;
    
    setLoading(true);
    setError(null);

    try {
      // FIX #2: Get token from Supabase session — never from localStorage manually
      const { data: { session } } = await supabase.auth.getSession();
      // If auth is required, uncomment:
      // if (!session) throw new Error('Not authenticated. Please log in.');

      const res = await fetch(`/api/agents/finance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ businessId, days, userMessage }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to run analysis');
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  return { data, loading, error, runAnalysis };
}
