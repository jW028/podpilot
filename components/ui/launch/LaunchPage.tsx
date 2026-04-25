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
  FiPackage,
} from "react-icons/fi";
import { IoSparkles } from "react-icons/io5";
import Button from "@/components/ui/shared/Button";
import { useLaunchAgent } from "@/hooks/useLaunchAgent";
import type { Product, DesignToLaunchPayload } from "@/lib/types";

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

const CATEGORY_KW: [string, string[]][] = [
  ["hoodie",     ["hoodie", "sweatshirt", "pullover", "zip-up", "zip up"]],
  ["tshirt",     ["t-shirt", "tshirt", "tee", "crew neck"]],
  ["longsleeve", ["long sleeve", "longsleeve", "long-sleeve"]],
  ["mug",        ["mug", "cup", "tumbler"]],
  ["poster",     ["poster", "print", "canvas", "wall art"]],
  ["hat",        ["hat", "cap", "beanie"]],
  ["bag",        ["bag", "tote", "backpack"]],
];

function inferCategories(text: string): string[] {
  const lower = (text ?? "").toLowerCase();
  const matched = CATEGORY_KW.filter(([, kws]) => kws.some((kw) => lower.includes(kw))).map(([cat]) => cat);
  return matched.length > 0 ? matched : [lower.replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "product"];
}

/** Extract a DesignToLaunchPayload from a product's saved attributes */
function extractDesignPayload(product: Product): DesignToLaunchPayload | undefined {
  const attrs = product.attributes;
  if (!attrs) return undefined;

  const blueprintAttr = attrs["blueprint_id"];
  const blueprintId = blueprintAttr?.value;
  if (!blueprintId || typeof blueprintId !== "number") return undefined;

  const prices: Record<string, number> = {};
  Object.entries(attrs).forEach(([key, attr]) => {
    if (key.startsWith("price_") && typeof attr?.value === "number") {
      prices[key.replace("price_", "")] = attr.value as number;
    }
  });

  const tagsAttr = attrs["tags"];
  const tags = Array.isArray(tagsAttr?.value)
    ? (tagsAttr.value as string[])
    : undefined;

  const pricingReasoning =
    typeof attrs["pricing_reasoning"]?.value === "string"
      ? (attrs["pricing_reasoning"].value as string)
      : undefined;

  const productTypeText =
    typeof attrs["product_type"]?.value === "string"
      ? (attrs["product_type"].value as string)
      : product.title;

  const printProviderAttr = attrs["print_provider_id"];
  const printProviderId =
    typeof printProviderAttr?.value === "number" ? printProviderAttr.value : undefined;

  const variantIdsAttr = attrs["variant_ids"];
  const variantIds =
    typeof variantIdsAttr?.value === "string" && variantIdsAttr.value
      ? variantIdsAttr.value
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isInteger(v) && v > 0)
      : Array.isArray(variantIdsAttr?.value)
        ? (variantIdsAttr.value as unknown as number[])
        : undefined;

  return {
    productName: product.title,
    description: product.description ?? "",
    blueprintId,
    printProviderId,
    variantIds,
    prices,
    pricingReasoning,
    tags,
    categories: inferCategories(productTypeText),
  };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  designing: "bg-blue-100 text-blue-700",
  ready: "bg-emerald-100 text-emerald-700",
  pushed: "bg-purple-100 text-purple-700",
  published: "bg-green-100 text-green-700",
  retired: "bg-gray-100 text-gray-500",
};

const LaunchPage = ({ businessId }: LaunchPageProps) => {
  const { data, loading: launching, error, runLaunch, setData, setError } =
    useLaunchAgent(businessId);

  // ── Product list ─────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // ── Sales channels ────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");

  // ── Polling ref ───────────────────────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ready + designing products
  useEffect(() => {
    if (!businessId) return;
    setProductsLoading(true);
    fetch(`/api/business/${businessId}/products?status=ready`)
      .then((r) => r.json())
      .then((list: Product[]) => {
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [businessId]);

  // Fetch sales channels
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

        if (list.length === 0) {
          const res = await fetch("/api/agents/launch/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          });
          const json = await res.json();
          if (res.ok && json.channels) list = json.channels;
        }

        setChannels(list);
        if (list.length > 0) setSelectedShopId(list[0].shop_id);
      } catch {}
    })();
  }, [businessId]);

  // Poll product_launches for publish completion
  useEffect(() => {
    const launchData = data as Record<string, unknown> | null;
    const launchId = launchData?.launch_id as string | undefined;
    const isPublishing =
      launchData &&
      !(launchData?.publish_result as Record<string, unknown>)?.published &&
      (launchData?.publish_result as Record<string, unknown>)?.publish_status === "publishing";

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
          .select("status, publish_status, external_product_id")
          .eq("id", launchId)
          .maybeSingle();
        if (!row) return;

        if (row.status === "published" || row.publish_status === "published") {
          setData({
            ...(launchData as object),
            publish_result: {
              ...(launchData?.publish_result as object),
              published: true,
              publish_status: "published",
              external_product_id: row.external_product_id,
            },
          });
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (row.status === "failed" || /fail|error|rejected/i.test(row.publish_status ?? "")) {
          setData({
            ...(launchData as object),
            publish_result: {
              ...(launchData?.publish_result as object),
              published: false,
              publish_status: row.publish_status ?? "failed",
            },
          });
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {}
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [data, setData]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const designPayload = selectedProduct
    ? extractDesignPayload(selectedProduct)
    : undefined;

  const hasPrices =
    designPayload && Object.keys(designPayload.prices).length > 0;

  const canLaunch = !!selectedProduct && !launching;

  // ── Workflow steps ────────────────────────────────────────────────────────
  const launchData = data as Record<string, unknown> | null;

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const researchTitle = hasPrices
      ? "Pricing (from design agent)"
      : "Market research & pricing";
    const researchDetail = hasPrices
      ? `Using design prices: ${Object.entries(designPayload!.prices)
          .map(([k, v]) => `${k} RM${(v / 100).toFixed(0)}`)
          .join(", ")}`
      : "Fetching live market data to determine optimal prices.";

    if (error) {
      return [
        { key: "request", title: "Launch request accepted", detail: "Payload sent to launch API.", status: "done" },
        { key: "research", title: researchTitle, detail: "Failed before completion.", status: "failed" },
        { key: "create", title: "Create Printify product", detail: "Pending.", status: "pending" },
        { key: "publish", title: "Publish to sales channel", detail: "Pending.", status: "pending" },
      ];
    }

    if (launching) {
      return [
        { key: "request", title: "Launch request accepted", detail: "Workflow initialised.", status: "done" },
        { key: "research", title: researchTitle, detail: hasPrices ? researchDetail : "Analysing market data…", status: hasPrices ? "done" : "running" },
        { key: "create", title: "Create Printify product", detail: "Waiting for pricing.", status: hasPrices ? "running" : "pending" },
        { key: "publish", title: "Publish to sales channel", detail: "Waiting for product ID.", status: "pending" },
      ];
    }

    const hasPriceData = !!launchData?.optimal_prices && Object.keys((launchData.optimal_prices as object) ?? {}).length > 0;
    const hasPrintifyProduct = !!(launchData?.printify_result as Record<string, unknown>)?.product_id;
    const published = !!(launchData?.publish_result as Record<string, unknown>)?.published;
    const publishInProgress = (launchData?.publish_result as Record<string, unknown>)?.publish_status === "publishing";

    return [
      { key: "request", title: "Launch request accepted", detail: "Launch ID generated.", status: launchData ? "done" : "pending" },
      { key: "research", title: researchTitle, detail: hasPriceData ? "Pricing complete." : researchDetail, status: hasPriceData ? "done" : "pending" },
      { key: "create", title: "Create Printify product", detail: hasPrintifyProduct ? "Product created on Printify." : "Waiting.", status: hasPrintifyProduct ? "done" : "pending" },
      { key: "publish", title: "Publish to sales channel", detail: published ? "Published and live." : publishInProgress ? "Publishing in progress…" : "Waiting.", status: published ? "done" : publishInProgress ? "running" : "pending" },
    ];
  }, [data, error, launching, hasPrices, designPayload]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedSteps = workflowSteps.filter((s) => s.status === "done").length;
  const progressPct = Math.round((completedSteps / workflowSteps.length) * 100);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setData(null);
    setError(null);
  };

  const handleLaunch = async () => {
    if (!canLaunch || !selectedProduct) return;
    await runLaunch({
      productId: selectedProduct.id,
      productData: {
        name: selectedProduct.title,
        description: selectedProduct.description ?? "",
        categories: designPayload?.categories ?? inferCategories(selectedProduct.title),
        tags: designPayload?.tags,
      },
      shopId: selectedShopId || undefined,
      designPayload,
    });
  };

  return (
    <section className="max-w-7xl mx-auto p-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark">Launch Agent</h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl">
            Select a ready product, choose a sales channel, and publish to Printify.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/business/${businessId}/launch/channels`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            Sales Channels <FiExternalLink size={13} />
          </Link>
          <Link
            href={`/business/${businessId}/launch/credentials`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            Credentials <FiExternalLink size={13} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 items-start">
        {/* ── Left: product list ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-neutral-300 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-dark">Ready to Launch</h2>
            <Link
              href={`/business/${businessId}/products`}
              className="text-xs text-primary-700 hover:underline"
            >
              Manage products →
            </Link>
          </div>

          {productsLoading ? (
            <div className="flex items-center justify-center py-16 text-neutral-400 gap-2 text-sm">
              <FiLoader className="animate-spin" /> Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
              <FiPackage size={32} className="text-neutral-300" />
              <p className="text-sm text-neutral-500">No products are ready for launch yet.</p>
              <Button
                variant="outline"
                size="sm"
                href={`/business/${businessId}/products`}
              >
                Go to Products
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {products.map((product) => {
                const dp = extractDesignPayload(product);
                const isSelected = selectedProduct?.id === product.id;
                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors ${
                      isSelected
                        ? "bg-primary-50 border-l-2 border-l-primary-500"
                        : "hover:bg-neutral-50 border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Status dot */}
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${
                      product.status === "ready" ? "bg-emerald-500" : "bg-blue-400"
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-dark truncate">
                          {product.title}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[product.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                          {product.status}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        {dp?.blueprintId && (
                          <span className="text-[10px] text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                            Blueprint {dp.blueprintId}
                          </span>
                        )}
                        {dp && Object.keys(dp.prices).length > 0 ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <IoSparkles className="text-[9px]" />
                            Prices set
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">
                            Will research pricing
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <FiCheckCircle className="text-primary-600 flex-shrink-0" size={16} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: launch controls + workflow ─────────────────────────── */}
        <div className="space-y-4">
          {/* Channel selector + launch */}
          <div className="rounded-xl border border-neutral-300 bg-light p-5 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-dark">Publish to</h2>

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

            {selectedProduct ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs space-y-1">
                <p className="font-medium text-dark">{selectedProduct.title}</p>
                {designPayload?.blueprintId && (
                  <p className="text-neutral-500">Blueprint ID: {designPayload.blueprintId}</p>
                )}
                {hasPrices && (
                  <p className="text-emerald-700">
                    Prices:{" "}
                    {Object.entries(designPayload!.prices)
                      .map(([k, v]) => `${k} RM${(v / 100).toFixed(0)}`)
                      .join(" · ")}
                  </p>
                )}
                {!hasPrices && (
                  <p className="text-neutral-400 italic">Launch agent will research pricing.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic">
                Select a product from the list to launch.
              </p>
            )}

            <Button
              variant="secondary"
              size="md"
              onClick={handleLaunch}
              disabled={!canLaunch}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {launching ? (
                <span className="inline-flex items-center gap-2">
                  <FiLoader className="animate-spin" /> Launching…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <IoSparkles />
                  {selectedProduct
                    ? hasPrices
                      ? "Launch with Design Prices"
                      : "Launch Product"
                    : "Select a product"}
                </span>
              )}
            </Button>
          </div>

          {/* Workflow steps */}
          {(launching || launchData) && (
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base text-dark">Workflow</h3>
                <span className="text-xs font-medium text-primary-800 px-2 py-0.5 rounded-full bg-primary-100 border border-primary-200">
                  {progressPct}%
                </span>
              </div>

              <div className="h-1.5 rounded-full bg-white border border-primary-200 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="space-y-1.5">
                {workflowSteps.map((step) => (
                  <div
                    key={step.key}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 flex items-start gap-2"
                  >
                    <span className="mt-0.5 shrink-0">
                      {step.status === "done" ? (
                        <FiCheckCircle className="text-primary-700" size={14} />
                      ) : step.status === "running" ? (
                        <FiLoader className="text-primary-700 animate-spin" size={14} />
                      ) : step.status === "failed" ? (
                        <FiAlertCircle className="text-red-500" size={14} />
                      ) : (
                        <FiCircle className="text-neutral-300" size={13} />
                      )}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-dark">{step.title}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {launchData && (
            <div className="rounded-xl border border-neutral-300 bg-white p-4 space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium">
                <FiCheckCircle size={12} />
                {(launchData?.printify_result as Record<string, unknown>)?.success
                  ? "Launch completed"
                  : "Launch finished with fallback"}
              </div>

              <div className="text-xs space-y-1">
                <p><span className="text-neutral-500">Launch ID:</span> <span className="text-dark font-mono">{launchData.launch_id as string}</span></p>
                <p><span className="text-neutral-500">Printify product:</span> <span className="text-dark font-mono">{(launchData.printify_result as Record<string, unknown>)?.product_id as string}</span></p>
                <p><span className="text-neutral-500">Publish status:</span> <span className="text-dark">{(launchData.publish_result as Record<string, unknown>)?.publish_status as string}</span></p>
              </div>

              {typeof launchData.final_message === "string" && launchData.final_message && (
                <p className="text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
                  {launchData.final_message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default LaunchPage;
