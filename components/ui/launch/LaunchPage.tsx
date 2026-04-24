"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCircle,
  FiExternalLink,
  FiLoader,
} from "react-icons/fi";
import Button from "@/components/ui/shared/Button";
import { useLaunchAgent } from "@/hooks/useLaunchAgent";

interface LaunchPageProps {
  businessId: string;
}

type WorkflowStatus = "pending" | "running" | "done" | "failed";

type WorkflowStep = {
  key: string;
  title: string;
  detail: string;
  status: WorkflowStatus;
};

type SalesChannel = {
  shop_id: string;
  title: string;
  channel: string;
};

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const LaunchPage = ({ businessId }: LaunchPageProps) => {
  const { data, loading, error, runLaunch, setData, setError } =
    useLaunchAgent(businessId);

  const storageKey = `launch-page-state:${businessId}`;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoriesInput, setCategoriesInput] = useState("hoodie, tshirt, mug");
  const [tagsInput, setTagsInput] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return;

        const parsed = JSON.parse(saved) as {
          name?: string;
          description?: string;
          categoriesInput?: string;
          tagsInput?: string;
          userMessage?: string;
          selectedShopId?: string;
        };

        setName(parsed.name || "");
        setDescription(parsed.description || "");
        setCategoriesInput(parsed.categoriesInput || "hoodie, tshirt, mug");
        setTagsInput(parsed.tagsInput || "");
        setUserMessage(parsed.userMessage || "");
        if (parsed.selectedShopId) setSelectedShopId(parsed.selectedShopId);
      } catch {
        // Ignore malformed local state and continue with defaults.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // Fetch sales channels from Supabase, then sync from Printify if DB is empty
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const { data: row } = await supabaseClient
          .from("businesses")
          .select("sales_channels")
          .eq("id", businessId)
          .maybeSingle();
        let list: SalesChannel[] = Array.isArray(row?.sales_channels)
          ? row.sales_channels
          : [];

        // If no channels in DB, sync from Printify
        if (list.length === 0) {
          const res = await fetch("/api/agents/launch/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          });
          const json = await res.json();
          if (res.ok && json.channels) {
            list = json.channels;
          }
        }

        setChannels(list);
        if (list.length > 0 && !selectedShopId) {
          setSelectedShopId(list[0].shop_id);
        }
      } catch {}
    })();
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll product_launches for publish status after agent returns
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const launchId = data?.launch_id;
    const isPublishing =
      data &&
      !data?.publish_result?.published &&
      data?.publish_result?.publish_status === "publishing";

    if (!launchId || !isPublishing) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const { data: row } = await supabaseClient
          .from("product_launches")
          .select("status, publish_status, external_product_id, launched_at")
          .eq("id", launchId)
          .maybeSingle();

        if (!row) return;

        if (row.status === "published" || row.publish_status === "published") {
          setData({
            ...data,
            publish_result: {
              ...data.publish_result,
              published: true,
              publish_status: "published",
              external_product_id: row.external_product_id,
            },
          });
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (
          row.status === "failed" ||
          /fail|error|rejected/i.test(row.publish_status || "")
        ) {
          setData({
            ...data,
            publish_result: {
              ...data.publish_result,
              published: false,
              publish_status: row.publish_status || "failed",
            },
          });
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {}
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [data, setData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          name,
          description,
          categoriesInput,
          tagsInput,
          userMessage,
          selectedShopId,
        }),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [
    categoriesInput,
    description,
    name,
    selectedShopId,
    storageKey,
    tagsInput,
    userMessage,
  ]);

  const categories = useMemo(
    () =>
      categoriesInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [categoriesInput],
  );

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    categories.length > 0;

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    if (error) {
      return [
        {
          key: "request",
          title: "Launch request accepted",
          detail: "Product payload sent from frontend to launch API.",
          status: "done",
        },
        {
          key: "research",
          title: "Market research",
          detail: "Research and pricing strategy failed before completion.",
          status: "failed",
        },
        {
          key: "create",
          title: "Create Printify product",
          detail: "Pending until research and pricing are successful.",
          status: "pending",
        },
        {
          key: "publish",
          title: "Publish to sales channel",
          detail: "Pending until product creation succeeds.",
          status: "pending",
        },
        {
          key: "summary",
          title: "Final summary",
          detail: "Agent summary unavailable because launch failed.",
          status: "pending",
        },
      ];
    }

    if (loading) {
      return [
        {
          key: "request",
          title: "Launch request accepted",
          detail: "Request received and workflow initialized.",
          status: "done",
        },
        {
          key: "research",
          title: "Market research",
          detail: "Analyzing market data and deciding profitable prices.",
          status: "running",
        },
        {
          key: "create",
          title: "Create Printify product",
          detail: "Waiting for pricing output from research phase.",
          status: "pending",
        },
        {
          key: "publish",
          title: "Publish to sales channel",
          detail: "Will run after product creation returns product ID.",
          status: "pending",
        },
        {
          key: "summary",
          title: "Final summary",
          detail: "Will be generated after all tool calls complete.",
          status: "pending",
        },
      ];
    }

    const hasPriceData =
      !!data?.optimal_prices &&
      Object.keys(data?.optimal_prices || {}).length > 0;
    const hasPrintifyProduct = !!data?.printify_result?.product_id;
    const published = !!data?.publish_result?.published;
    const publishInProgress =
      data?.publish_result?.publish_status === "publishing";
    const hasSummary = !!(
      data?.final_message && String(data.final_message).trim().length > 0
    );

    return [
      {
        key: "request",
        title: "Launch request accepted",
        detail: "Launch workflow started and launch ID generated.",
        status: data ? "done" : "pending",
      },
      {
        key: "research",
        title: "Market research",
        detail: hasPriceData
          ? "Pricing model completed with suggested prices."
          : "No pricing output returned by the agent.",
        status: hasPriceData ? "done" : "pending",
      },
      {
        key: "create",
        title: "Create Printify product",
        detail: hasPrintifyProduct
          ? "Printify product was created successfully."
          : "No Printify product ID returned.",
        status: hasPrintifyProduct ? "done" : "pending",
      },
      {
        key: "publish",
        title: "Publish to sales channel",
        detail: published
          ? "Product is published and ready on connected sales channel."
          : publishInProgress
            ? "Printify accepted publish request and is still processing."
            : "Product was created but publish has not completed.",
        status: published ? "done" : publishInProgress ? "running" : "pending",
      },
      {
        key: "summary",
        title: "Final summary",
        detail: hasSummary
          ? "Agent generated final launch summary."
          : "No final summary text was returned.",
        status: hasSummary ? "done" : "pending",
      },
    ];
  }, [data, error, loading]);

  const completedSteps = workflowSteps.filter(
    (step) => step.status === "done",
  ).length;
  const progressPct = Math.round((completedSteps / workflowSteps.length) * 100);

  const handleLaunch = async () => {
    if (!canSubmit || loading) return;

    await runLaunch({
      productData: {
        name: name.trim(),
        description: description.trim(),
        categories,
        ...(tags.length > 0 ? { tags } : {}),
      },
      shopId: selectedShopId || undefined,
      userMessage: userMessage.trim() || null,
    });
  };

  const handleReset = () => {
    setName("");
    setDescription("");
    setCategoriesInput("hoodie, tshirt, mug");
    setTagsInput("");
    setUserMessage("");
    setData(null);
    setError(null);
    localStorage.removeItem(storageKey);
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6 p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark">
            Launch Agent
          </h1>
          <p className="text-sm text-neutral-500 mt-2 max-w-2xl">
            Launch a product to Printify from one guided form. This is
            single-run mode for now, and will be reused later for automatic
            launch after design approval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/business/${businessId}/launch/channels`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            Sales Channels
            <FiExternalLink size={14} />
          </Link>
          <Link
            href={`/business/${businessId}/launch/credentials`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            Setup Credentials Guide
            <FiExternalLink size={14} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-neutral-300 bg-light p-5 space-y-4">
          <h2 className="font-serif text-xl text-dark">Launch Input</h2>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Product Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Malaysian Cyber Cat Hoodie"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Futuristic cyber-y2k cat wearing songkok and batik pattern."
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Categories (comma-separated)
            </span>
            <input
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Tags (optional, comma-separated)
            </span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Publish to
            </span>
            {channels.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No sales channels connected.{" "}
                <Link
                  href={`/business/${businessId}/launch/channels`}
                  className="text-primary-700 hover:underline"
                >
                  Set up a channel
                </Link>
              </p>
            ) : (
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
              >
                {channels.map((ch) => (
                  <option key={ch.shop_id} value={ch.shop_id}>
                    {ch.title} ({ch.channel})
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-600">
              Launch Instruction (optional)
            </span>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              rows={3}
              placeholder="Prioritize premium Malaysia-market pricing."
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-dark outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleLaunch}
              disabled={!canSubmit || loading}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <FiLoader className="animate-spin" />
                  Launching...
                </span>
              ) : (
                "Launch Product"
              )}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-300 bg-white p-5 space-y-5">
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg text-dark">Launch Workflow</h2>
              <span className="text-xs font-medium text-primary-800 px-2.5 py-1 rounded-full bg-primary-100 border border-primary-200">
                {progressPct}% complete
              </span>
            </div>

            <div className="h-2 rounded-full bg-white border border-primary-200 overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="space-y-2">
              {workflowSteps.map((step) => {
                const icon =
                  step.status === "done" ? (
                    <FiCheckCircle className="text-primary-700" size={15} />
                  ) : step.status === "running" ? (
                    <FiLoader
                      className="text-primary-700 animate-spin"
                      size={15}
                    />
                  ) : step.status === "failed" ? (
                    <FiAlertCircle className="text-red-600" size={15} />
                  ) : (
                    <FiCircle className="text-neutral-400" size={14} />
                  );

                return (
                  <div
                    key={step.key}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 flex items-start gap-2.5"
                  >
                    <span className="mt-0.5 shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark">
                        {step.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <h2 className="font-serif text-xl text-dark mb-4">Launch Result</h2>

          {!data && (
            <p className="text-sm text-neutral-500">
              Run the launch agent to view pricing, Printify output, and the
              final launch summary.
            </p>
          )}

          {data && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 text-primary-800 text-xs font-medium">
                <FiCheckCircle size={14} />
                {data?.printify_result?.success
                  ? "Launch completed"
                  : "Launch finished with fallback"}
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-neutral-500">Product:</span>{" "}
                  <span className="text-dark font-medium">
                    {data.product_name || "—"}
                  </span>
                </p>
                <p>
                  <span className="text-neutral-500">Launch ID:</span>{" "}
                  <span className="text-dark">{data.launch_id || "—"}</span>
                </p>
                <p>
                  <span className="text-neutral-500">Timestamp:</span>{" "}
                  <span className="text-dark">{data.timestamp || "—"}</span>
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-dark mb-2">
                  Suggested Prices
                </h3>
                <pre className="text-xs bg-light-secondary border border-neutral-300 rounded-lg p-3 overflow-auto text-dark">
                  {JSON.stringify(data.optimal_prices || {}, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-dark mb-2">
                  Printify Result
                </h3>
                <pre className="text-xs bg-light-secondary border border-neutral-300 rounded-lg p-3 overflow-auto text-dark">
                  {JSON.stringify(data.printify_result || {}, null, 2)}
                </pre>
              </div>

              {data.final_message && (
                <div>
                  <h3 className="text-sm font-semibold text-dark mb-2">
                    Agent Summary
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {data.final_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default LaunchPage;
