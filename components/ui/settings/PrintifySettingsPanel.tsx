"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/shared/Button";

type PrintifyStatus = {
  connected: boolean;
  shopId: string | null;
  shopName: string | null;
  tokenHint: string | null;
};

type ErrorResponse = {
  error?: string;
};

function hasError(
  response: PrintifyStatus | ErrorResponse,
): response is ErrorResponse {
  return typeof (response as ErrorResponse).error === "string";
}

export default function PrintifySettingsPanel({
  businessId,
}: {
  businessId: string;
}) {
  const { session } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<PrintifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId || !session?.access_token) {
      return;
    }

    const loadStatus = async () => {
      try {
        const response = await fetch(`/api/businesses/${businessId}/printify`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const json = (await response.json()) as PrintifyStatus | ErrorResponse;
        if (!response.ok && hasError(json)) {
          throw new Error(json.error || "Unable to load Printify status.");
        }

        if (hasError(json)) {
          throw new Error(json.error || "Unable to load Printify status.");
        }

        setStatus(json);
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Printify status.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [businessId, session?.access_token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token) {
      setError("You must be signed in to save credentials.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/businesses/${businessId}/printify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          apiKey,
        }),
      });

      const json = (await response.json()) as {
        tokenHint?: string;
        shopId?: string | null;
        shopName?: string | null;
      } & ErrorResponse;
      if (!response.ok) {
        throw new Error(json.error || "Unable to save Printify API key.");
      }

      setApiKey("");
      setStatus((current) => ({
        connected: true,
        shopId: json.shopId ?? current?.shopId ?? null,
        shopName: json.shopName ?? current?.shopName ?? null,
        tokenHint: json.tokenHint || current?.tokenHint || null,
      }));
      setSuccess("Printify API key saved and encrypted in Supabase.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save Printify API key.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex justify-center items-center w-full h-full">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark">
            Printify Credentials
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Save your Printify API key here. It is encrypted before being stored
            in Supabase.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="font-serif text-xl text-dark">
                Connection status
              </h2>
              <p className="text-sm text-neutral-500">
                {loading
                  ? "Loading current connection..."
                  : status?.connected
                    ? `Connected${status.tokenHint ? ` - ${status.tokenHint}` : ""}`
                    : "Not connected yet"}
              </p>
              {status?.shopId ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Primary shop: {status.shopName || "Unnamed shop"} (
                  {status.shopId})
                </p>
              ) : null}
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-dark">
                Printify API key
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="paste raw Printify PAT (no Bearer prefix)"
                className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm text-dark outline-none transition-colors focus:border-primary-500"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="min-w-40">
                {saving ? "Saving..." : "Save encrypted key"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
