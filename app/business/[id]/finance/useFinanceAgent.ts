import { useState } from 'react';

export function useFinanceAgent(businessId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async ({ days = 30, userMessage }: { days?: number, userMessage?: string }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/agents/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, days, userMessage })
      });

      if (!response.ok) {
        const errAlert = await response.json();
        throw new Error(errAlert.error || 'Failed to fetch analysis');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, runAnalysis };
}
