import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { LaunchProductInput, DesignToLaunchPayload } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RunLaunchParams = {
  productId?: string;
  productData: LaunchProductInput;
  shopId?: string;
  salesChannelIds?: string[];
  designPayload?: DesignToLaunchPayload;
  userMessage?: string | null;
};

type PersistedState = {
  data?: unknown;
  error?: string | null;
  loading?: boolean;
};

export function useLaunchAgent(businessId: string | string[], productId?: string) {
  const resolvedBusinessId = Array.isArray(businessId) ? businessId[0] : businessId;
  const storageKey = `launch-agent-state:${resolvedBusinessId}`;
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed: PersistedState = JSON.parse(saved);
      setTimeout(() => {
        if (parsed.data !== undefined) setData(parsed.data);
        if (parsed.error !== undefined) setError(parsed.error);
        if (parsed.loading) setLoading(false);
      }, 0);
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
    async ({ productId: paramProductId, productData, shopId, salesChannelIds, designPayload, userMessage = null }: RunLaunchParams) => {
      if (!resolvedBusinessId) return;

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
            businessId: resolvedBusinessId,
            productId: paramProductId ?? productId,
            productData,
            shopId,
            salesChannelIds,
            designPayload,
            userMessage,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || 'Failed to launch product');
        }

        setData(json);
        return json;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to launch product';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [resolvedBusinessId, productId]
  );

  return { data, loading, error, runLaunch, setData, setError };
}
