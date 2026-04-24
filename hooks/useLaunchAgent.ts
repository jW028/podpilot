import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { LaunchProductInput } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RunLaunchParams = {
  productData: LaunchProductInput;
  shopId?: string;
  userMessage?: string | null;
};

type PersistedState = {
  data?: any;
  error?: string | null;
  loading?: boolean;
};

export function useLaunchAgent(businessId: string | string[]) {
  const storageKey = `launch-agent-state:${businessId}`;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed: PersistedState = JSON.parse(saved);
      if (parsed.data !== undefined) setData(parsed.data);
      if (parsed.error !== undefined) setError(parsed.error);
      // Don't restore loading=true — if the page was closed mid-launch,
      // the in-flight request is gone. Mark it as not loading.
      if (parsed.loading) {
        setLoading(false);
      }
    } catch {}
    mounted.current = true;
  }, [storageKey]);

  // Persist state changes
  useEffect(() => {
    if (!mounted.current) return;
    try {
      const state: PersistedState = { data, error, loading };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [data, error, loading, storageKey]);

  const runLaunch = useCallback(
    async ({ productData, shopId, userMessage = null }: RunLaunchParams) => {
      if (!businessId) return;

      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch('/api/agents/launch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            businessId: '123e4567-e89b-12d3-a456-426614174000', // temporary mock
            productId: 'aaaaaaaa-0001-0001-0001-000000000005', // temporary mock
            productData,
            shopId,
            userMessage,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || 'Failed to launch product');
        }

        setData(json);
        return json;
      } catch (err: any) {
        const message = err?.message || 'Failed to launch product';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [businessId]
  );

  return { data, loading, error, runLaunch, setData, setError };
}
