"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiExternalLink,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import Button from "@/components/ui/shared/Button";

interface ChannelSetupPageProps {
  businessId: string;
}

type SalesChannel = {
  shop_id: string;
  title: string;
  channel: string;
};

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SETUP_STEPS = [
  {
    title: "Open Printify Dashboard",
    detail: 'Go to Stores in the left sidebar, then click "Add new store".',
  },
  {
    title: "Choose a Sales Channel",
    detail:
      "Select from Etsy, Shopify, WooCommerce, eBay, or other available channels.",
  },
  {
    title: "Follow Printify's Connection Flow",
    detail:
      "Each channel has its own authorization steps. Complete them to link the store.",
  },
  {
    title: "Refresh Channels Here",
    detail:
      'Once connected in Printify, click "Refresh Channels" below to sync them to PodCoPilot.',
  },
];

const ChannelSetupPage = ({ businessId }: ChannelSetupPageProps) => {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      const { data: row, error: err } = await supabaseClient
        .from("businesses")
        .select("sales_channels")
        .eq("id", businessId)
        .maybeSingle();

      if (err) throw err;
      const list: SalesChannel[] = Array.isArray(row?.sales_channels)
        ? row.sales_channels
        : [];
      setChannels(list);
      setError(null);
    } catch {
      setError("Failed to load sales channels.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      const res = await fetch("/api/agents/launch/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ businessId }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to refresh channels");
      }

      setChannels(json.channels || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh channels",
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChannels();
      // Also sync from Printify on initial load so channels are always up to date
      handleRefresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="max-w-4xl mx-auto space-y-6 p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark">
            Sales Channels
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Manage your connected Printify sales channels and set up new ones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <FiRefreshCw className="animate-spin" size={14} />
                Refreshing...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <FiRefreshCw size={14} />
                Refresh Channels
              </span>
            )}
          </Button>
          <Link
            href={`/business/${businessId}/launch`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            <FiArrowLeft size={14} />
            Back to Launch
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Connected channels */}
      <div className="rounded-xl border border-neutral-300 bg-white p-5 space-y-4">
        <h2 className="font-serif text-xl text-dark">Connected Channels</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <FiLoader className="animate-spin" size={14} />
            Loading channels...
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No sales channels connected yet. Follow the setup guide below to
            connect your first channel.
          </p>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <div
                key={ch.shop_id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-light px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FiCheckCircle
                    className="text-primary-700 shrink-0"
                    size={16}
                  />
                  <div>
                    <p className="text-sm font-medium text-dark">{ch.title}</p>
                    <p className="text-xs text-neutral-500">{ch.channel}</p>
                  </div>
                </div>
                <span className="text-xs text-neutral-400">
                  Shop {ch.shop_id}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-neutral-300 bg-white p-5 space-y-5">
        <h2 className="font-serif text-xl text-dark">Connect a New Channel</h2>
        <p className="text-sm text-neutral-600">
          Each Printify store is connected to one sales channel (Etsy, Shopify,
          etc.). To add a new channel, create a new store inside your Printify
          account.
        </p>

        <div className="space-y-4">
          {SETUP_STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-primary-100 border border-primary-200 flex items-center justify-center text-xs font-semibold text-primary-800">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-dark">{step.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <a
            href="https://app.printify.com/stores"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-300 bg-primary-50 text-primary-800 text-sm font-medium hover:bg-primary-100 transition-colors"
          >
            Open Printify Stores
            <FiExternalLink size={14} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default ChannelSetupPage;
