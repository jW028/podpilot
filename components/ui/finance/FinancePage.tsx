"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useFinanceAgent } from "@/hooks/useFinanceAgent";
import type { ProductSignal } from '@/lib/types';
// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Summary {
  total_orders: number;
  total_revenue: string;
  total_costs: string;
  total_profit: string;
  overall_margin_pct: string;
}

interface ProductRow {
  product_id: string;
  title: string;
  units_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: string;
}
interface ChartPoint {
  month: string;
  revenue: number;
  isCurrent: boolean;
}

interface ChatMessage {
  role: "ai" | "user";
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number string as RM currency */
function rm(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return `RM ${n.toFixed(2)}`;
}

/** Format a percentage string */
function pct(value: string | undefined): string {
  if (!value) return "—";
  return `${parseFloat(value).toFixed(1)}%`;
}

/** Get the current month + year label */
function currentMonthLabel(): string {
  return new Date().toLocaleString("en-MY", { month: "long", year: "numeric" });
}

/** Compute delta between last two chart points */
function computeDelta(chartData: ChartPoint[]): string | null {
  if (chartData.length < 2) return null;
  const current = chartData[chartData.length - 1].revenue;
  const previous = chartData[chartData.length - 2].revenue;
  if (previous === 0) return null;
  const pctChange = ((current - previous) / previous) * 100;
  const sign = pctChange >= 0 ? "↑" : "↓";
  const prevMonth = chartData[chartData.length - 2].month;
  return `${sign} ${Math.abs(pctChange).toFixed(1)}% vs ${prevMonth}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  highlight,
}: {
  label: string;
  value: string;
  delta: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[16px_18px]">
      <div className="text-[11px] text-[#6B6A64] uppercase tracking-[0.06em] mb-[6px]">
        {label}
      </div>
      <div className="font-serif text-[26px] text-[#141412] leading-[1.1]">
        {value}
      </div>
      {delta ? (
        <div
          className={`text-[11px] mt-[4px] ${
            highlight
              ? delta.startsWith("↑")
                ? "text-[#C0584A]"
                : "text-[#4A8C5C]"
              : delta.startsWith("↑")
                ? "text-[#4A8C5C]"
                : "text-[#C0584A]"
          }`}
        >
          {delta}
        </div>
      ) : (
        <div className="text-[11px] mt-[4px] text-[#C4C3BC]">
          No prior period data
        </div>
      )}
    </div>
  );
}

function SignalIcon({ action }: { action: string }) {
  const upper = action.toUpperCase();
  if (upper === "REPRICE")
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold">
        ↑
      </span>
    );
  if (upper === "RETIRE")
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FEE2E2] text-[#C0584A] text-[10px] font-bold">
        ✕
      </span>
    );
  // BOOST
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#D1FAE5] text-[#2D7A4F] text-[10px] font-bold">
      ★
    </span>
  );
}

function RevenueChart({ chartData }: { chartData: ChartPoint[] }) {
  if (chartData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12px] text-[#6B6A64]">No revenue history yet.</p>
      </div>
    );
  }

  const CHART_HEIGHT = 110; // px
  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  return (
    <>
      <div
        className="flex items-end gap-[4px] mt-[10px]"
        style={{ height: `${CHART_HEIGHT}px` }}
      >
        {chartData.map((point, i) => {
          const barHeightPx = Math.max(
            (point.revenue / maxRevenue) * CHART_HEIGHT,
            4,
          );
          return (
            <div
              key={i}
              className="flex-1 relative group"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-[#141412] text-[#FAFAF8] text-[10px] px-[6px] py-[3px] rounded-[4px] whitespace-nowrap z-10">
                {rm(point.revenue)}
              </div>
              {/* Bar — absolutely positioned from bottom */}
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-[4px_4px_0_0] transition-all ${
                  point.isCurrent
                    ? "bg-gradient-to-t from-[#141412] to-[#2A2A27]"
                    : "bg-gradient-to-t from-[#9E7A2E] to-[#C9A84C] opacity-60 group-hover:opacity-80"
                }`}
                style={{ height: `${barHeightPx}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[4px] mt-[8px]">
        {chartData.map((point, i) => (
          <div
            key={i}
            className={`flex-1 text-center text-[10px] ${
              point.isCurrent
                ? "font-semibold text-[#141412]"
                : "text-[#6B6A64]"
            }`}
          >
            {point.month}
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function FinancePage({ businessId }: { businessId: string }) {
  const { data, loading, error, runAnalysis } = useFinanceAgent(businessId);
  const [days] = useState(30);
  const [chatInput, setChatInput] = useState("");
  const CHAT_KEY = 'finance_chat_${businessId}';
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CHAT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [reportLoading, setReportLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Run on mount
  useEffect(() => {
    if (businessId) runAnalysis({ days });
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push AI insights into chat when data arrives
  useEffect(() => {
    if (data?.insights) {
      const timer = setTimeout(() => {
        setMessages((prev) => {
          // Don't duplicate if same insights already in chat
          if (prev.some((m) => m.role === "ai" && m.text === data.insights))
            return prev;
          return [...prev, { role: "ai", text: data.insights }];
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [data?.insights]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-100)));
    } catch {

    }
  }, [messages, CHAT_KEY]);
  const handleSend = useCallback(() => {
    if (!chatInput.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: chatInput }]);
    runAnalysis({ days, userMessage: chatInput });
    setChatInput("");
  }, [chatInput, days, loading, runAnalysis]);

  // ── Derived data ────────────────────────────────────────────────────────
  const summary: Summary | undefined = data?.metrics?.summary;
  const products: ProductRow[] = useMemo(
    () => data?.metrics?.by_product ?? [],
    [data?.metrics?.by_product],
  );
  const signals: ProductSignal[] = data?.signals ?? [];
  const chartData: ChartPoint[] = data?.chartData ?? [];
  const businessName: string = data?.businessName ?? "your store";
  const marketplace: string = data?.marketplace ?? "";
  const hasData = !!summary;

  // Compute deltas from chart history
  const revenueDelta = computeDelta(chartData);

  // Cost delta (inverse: up = bad)
  const costDeltaRaw =
    chartData.length >= 2
      ? ((chartData[chartData.length - 1].revenue -
          chartData[chartData.length - 2].revenue) /
          Math.max(chartData[chartData.length - 2].revenue, 1)) *
        100
      : null;

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (products.length === 0) return;
    const headers = [
      "Product",
      "Units Sold",
      "Revenue (RM)",
      "Cost (RM)",
      "Profit (RM)",
      "Margin (%)",
    ];
    const rows = products.map((p) => [
      `"${p.title}"`,
      p.units_sold,
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.profit.toFixed(2),
      p.margin_pct,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${businessId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products, businessId]);

  // ── Generate Report ─────────────────────────────────────────────────────
  const handleGenerateReport = useCallback(async () => {
    if (!hasData || reportLoading) return;
    setReportLoading(true);
    try {
      const res = await fetch("/api/agents/finance/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, days }),
      });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-report-${businessId}-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error(
        "[FinancePage] Report generation error:",
        err instanceof Error ? err.message : String(err),
      );
      alert("Report generation failed. Please try again.");
    } finally {
      setReportLoading(false);
    }
  }, [hasData, reportLoading, businessId, days]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── LEFT MAIN AREA ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* ── TOPBAR ──────────────────────────────────────────────────── */}
        <div className="p-[16px_28px] flex items-center justify-between border-b border-[#E8E7E2] bg-[#FAFAF8] sticky top-0 z-10 shrink-0">
          <div>
            <div className="font-serif text-[20px]">Finance</div>
            <div className="text-[12px] text-[#6B6A64] mt-[1px]">
              {hasData
                ? `AI-powered profit analysis · ${businessName}`
                : "AI-powered profit analysis"}
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            <button
              onClick={handleExportCSV}
              disabled={products.length === 0}
              className="px-[16px] py-[8px] rounded-[8px] border border-[#E8E7E2] bg-transparent text-[#6B6A64] hover:bg-[#F4F3EF] hover:text-[#141412] disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-medium transition cursor-pointer"
            >
              Export Products CSV
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={!hasData || reportLoading}
              className="px-[16px] py-[8px] rounded-[8px] border-none bg-[#C9A84C] hover:bg-[#9E7A2E] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF8] text-[13px] font-medium transition cursor-pointer flex items-center gap-[6px]"
            >
              {reportLoading ? (
                <>
                  <div className="w-[12px] h-[12px] border-[2px] border-[#FAFAF8] border-t-transparent rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                "✦ Generate Report"
              )}
            </button>
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        <div className="p-[24px_28px]">
          {/* Error banner */}
          {error && (
            <div className="bg-[#C0584A]/10 border border-[#C0584A]/20 text-[#C0584A] rounded-[12px] px-[20px] py-[16px] text-[14px] font-medium mb-[20px]">
              {error}
            </div>
          )}

          {/* First-load spinner */}
          {!hasData && loading && (
            <div className="h-[400px] flex flex-col items-center justify-center text-[14px] text-[#6B6A64]">
              <div className="w-[24px] h-[24px] border-[2px] border-[#C9A84C] border-t-transparent rounded-full animate-spin mb-[12px]" />
              Analysing {businessName} financial data…
            </div>
          )}

          {/* No data + no error + not loading */}
          {!hasData && !loading && !error && (
            <div className="h-[400px] flex flex-col items-center justify-center text-center gap-[8px]">
              <div className="text-[32px] opacity-30">◈</div>
              <p className="text-[14px] font-medium text-[#141412]">
                No financial data yet
              </p>
              <p className="text-[12px] text-[#6B6A64] max-w-[320px]">
                Connect Printify and fulfil at least one order to start seeing
                analysis here.
              </p>
            </div>
          )}

          {hasData && (
            <>
              {/* ── METRIC CARDS ──────────────────────────────────────── */}
              <div className="grid grid-cols-4 gap-[12px] mb-[20px]">
                <MetricCard
                  label={`REVENUE (${new Date().toLocaleString("en-MY", { month: "short" }).toUpperCase()})`}
                  value={rm(summary?.total_revenue)}
                  delta={revenueDelta}
                />
                <MetricCard
                  label="PRINTIFY COSTS"
                  value={rm(summary?.total_costs)}
                  delta={
                    costDeltaRaw !== null
                      ? `${costDeltaRaw >= 0 ? "↑" : "↓"} ${Math.abs(costDeltaRaw).toFixed(1)}% vs ${chartData[chartData.length - 2]?.month ?? "prev"}`
                      : null
                  }
                  highlight
                />
                <MetricCard
                  label="NET PROFIT"
                  value={rm(summary?.total_profit)}
                  delta={revenueDelta}
                />
                <MetricCard
                  label="MARGIN"
                  value={pct(summary?.overall_margin_pct)}
                  delta={
                    chartData.length >= 2
                      ? (() => {
                          const cur = parseFloat(
                            summary?.overall_margin_pct ?? "0",
                          );
                          return `${cur >= 30 ? "Healthy" : "Below target"} · target 30%+`;
                        })()
                      : null
                  }
                />
              </div>

              {/* ── CHART + SIGNALS (full width, stacked) ─────────────── */}
              <div className="flex flex-col gap-[16px] mb-[16px]">
                {/* Revenue chart */}
                <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] h-[220px] flex flex-col">
                  <div className="font-serif text-[16px] text-[#141412] mb-[4px]">
                    Monthly Revenue
                  </div>
                  <div className="text-[11px] text-[#6B6A64] mb-[8px]">
                    {chartData.length > 0
                      ? `Last ${chartData.length} months · ${marketplace ? marketplace.charAt(0).toUpperCase() + marketplace.slice(1) : "all channels"}`
                      : "No history available"}
                  </div>
                  <div className="flex-1 flex flex-col min-h-0">
                    <RevenueChart chartData={chartData} />
                  </div>
                </div>

                {/* Agent Signals */}
                <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] min-h-[160px] overflow-hidden flex flex-col">
                  <div className="font-serif text-[16px] text-[#141412] mb-[12px] flex items-center justify-between">
                    ◈ Agent Signals
                    <div className="flex items-center gap-[6px]">
                      {signals.length > 0 && (
                        <span className="bg-[#C9A84C] text-[#FAFAF8] text-[9px] font-semibold px-[6px] py-[2px] rounded-full">
                          {signals.length}
                        </span>
                      )}
                      <div className="text-[10px] text-[#6B6A64] font-sans font-normal border border-[#E8E7E2] rounded-full px-[8px] py-[2px] bg-[#F4F3EF]">
                        Auto-updated
                      </div>
                    </div>
                  </div>

                  {signals.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px] overflow-y-auto max-h-[200px] pr-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#E8E7E2] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {signals.map((sig, idx) => (
                        <div
                          key={idx}
                          className="flex gap-[10px] items-start p-[10px_12px] bg-[#F4F3EF] rounded-[8px]"
                        >
                          <div className="mt-[2px] shrink-0">
                            <SignalIcon action={sig.action} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-[#141412] flex items-center gap-[6px] flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-[6px] py-[1px] rounded-[4px] ${
                                  sig.action.toUpperCase() === "BOOST"
                                    ? "bg-[#D1FAE5] text-[#2D7A4F]"
                                    : sig.action.toUpperCase() === "REPRICE"
                                      ? "bg-[#FEF3C7] text-[#D97706]"
                                      : "bg-[#FEE2E2] text-[#C0584A]"
                                }`}
                              >
                                {sig.action.toUpperCase()}
                              </span>
                              <span className="truncate">{sig.product_title}</span>
                              {sig.priority === "HIGH" && (
                                <span className="text-[9px] text-[#C0584A] font-medium">
                                  ● HIGH
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B6A64] mt-[3px] leading-snug">
                              {sig.reason}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-[6px] py-[20px]">
                      <div className="text-[22px] opacity-20">◈</div>
                      <p className="text-[12px] text-[#6B6A64]">
                        No active signals at the moment.
                      </p>
                      <p className="text-[11px] text-[#C4C3BC]">
                        Signals appear when margin thresholds are breached.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── PRODUCT PERFORMANCE TABLE ──────────────────────────── */}
              <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] overflow-hidden">
                <div className="px-[20px] py-[16px] border-b border-[#E8E7E2] flex items-center justify-between">
                  <div className="font-serif text-[16px] text-[#141412]">
                    Product Performance
                  </div>
                  <div className="text-[11px] text-[#6B6A64]">
                    {summary?.total_orders ?? 0} total orders · last {days} days
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E7E2]">
                        {[
                          "Product",
                          "Units Sold",
                          "Revenue",
                          "Printify Cost",
                          "Profit",
                          "Margin",
                          "Signal",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-[20px] py-[10px] text-[10px] font-semibold text-[#6B6A64] uppercase tracking-[0.06em]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? (
                        products
                          .sort((a, b) => b.profit - a.profit)
                          .map((p) => {
                            const productSignal = signals.find(
                              (s) => s.product_id === p.product_id,
                            );
                            const marginNum = parseFloat(p.margin_pct);
                            return (
                              <tr
                                key={p.product_id}
                                className="hover:bg-[#F4F3EF] border-b border-[#E8E7E2] last:border-b-0 transition-colors"
                              >
                                <td className="px-[20px] py-[12px] font-medium text-[#141412] text-[13px] max-w-[200px]">
                                  <div className="truncate">{p.title}</div>
                                  <div className="text-[10px] text-[#9E9D97] font-normal">
                                    {p.product_id}
                                  </div>
                                </td>
                                <td className="px-[20px] py-[12px] text-[13px] text-[#6B6A64]">
                                  {p.units_sold}
                                </td>
                                <td className="px-[20px] py-[12px] text-[13px]">
                                  {rm(p.revenue)}
                                </td>
                                <td className="px-[20px] py-[12px] text-[13px] text-[#6B6A64]">
                                  {rm(p.cost)}
                                </td>
                                <td
                                  className={`px-[20px] py-[12px] text-[13px] font-semibold ${
                                    p.profit < 0
                                      ? "text-[#C0584A]"
                                      : "text-[#2D7A4F]"
                                  }`}
                                >
                                  {rm(p.profit)}
                                </td>
                                <td className="px-[20px] py-[12px] text-[13px]">
                                  <span
                                    className={`inline-block px-[8px] py-[2px] rounded-full text-[11px] font-semibold ${
                                      marginNum >= 40
                                        ? "bg-[#D1FAE5] text-[#2D7A4F]"
                                        : marginNum >= 25
                                          ? "bg-[#FEF3C7] text-[#D97706]"
                                          : "bg-[#FEE2E2] text-[#C0584A]"
                                    }`}
                                  >
                                    {pct(p.margin_pct)}
                                  </span>
                                </td>
                                <td className="px-[20px] py-[12px] text-[13px]">
                                  {productSignal ? (
                                    <span
                                      className={`inline-flex items-center gap-[4px] text-[11px] font-semibold px-[8px] py-[2px] rounded-full ${
                                        productSignal.action.toUpperCase() ===
                                        "BOOST"
                                          ? "bg-[#D1FAE5] text-[#2D7A4F]"
                                          : productSignal.action.toUpperCase() ===
                                              "REPRICE"
                                            ? "bg-[#FEF3C7] text-[#D97706]"
                                            : "bg-[#FEE2E2] text-[#C0584A]"
                                      }`}
                                    >
                                      <SignalIcon action={productSignal.action} />
                                      {productSignal.action.toUpperCase()}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[#C4C3BC]">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-[20px] py-[24px] text-center"
                          >
                            <div className="text-[24px] opacity-20 mb-[6px]">
                              ◈
                            </div>
                            <p className="text-[13px] text-[#6B6A64]">
                              No product data available yet.
                            </p>
                            <p className="text-[11px] text-[#C4C3BC] mt-[2px]">
                              Products appear once Printify orders are fulfilled.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT: FINANCE AGENT CHAT SIDEBAR ───────────────────────────── */}
      <div className="w-[340px] shrink-0 border-l border-[#E8E7E2] bg-[#2A2A27] flex flex-col h-screen sticky top-0">
        {/* Header */}
        <div className="flex items-center gap-[10px] px-[20px] py-[16px] border-b border-[#FAFAF8]/10 shrink-0">
          <div className="w-[30px] h-[30px] rounded-[8px] bg-[#C9A84C] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-bold text-[#FAFAF8]">◈</span>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#FAFAF8]">
              Finance Agent
            </div>
            <div className="text-[10px] text-[#FAFAF8]/40 mt-[1px]">
              {currentMonthLabel()} · {businessName}
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(CHAT_KEY);
              setMessages([]);
            }}
            className="ml-auto text-[10px] text-[#FAFAF8]/30 hover:text-[#FAFAF8]/60 transition px-[6px] py-[2px] rounded hover:bg-[#FAFAF8]/10"
          >
            Clear
          </button>
          {loading && (
            <div className="ml-auto flex items-center gap-[4px]">
              <div className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce" />
              <div
                className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-[16px] py-[14px] flex flex-col gap-[12px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#FAFAF8]/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-[6px] text-center px-[8px] mt-[60px]">
              <div className="text-[28px] opacity-20">◈</div>
              <p className="text-[12px] text-[#FAFAF8]/40">
                Finance Agent is ready. Ask about margins, signals, or product
                performance.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-[8px] ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] shrink-0 font-semibold ${
                  msg.role === "ai"
                    ? "bg-[#C9A84C] text-[#FAFAF8]"
                    : "bg-[#FAFAF8]/20 text-[#FAFAF8]"
                }`}
              >
                {msg.role === "ai" ? "FA" : "U"}
              </div>
              <div
                className={`px-[12px] py-[10px] text-[13px] leading-relaxed max-w-[85%] whitespace-pre-line rounded-[2px] ${
                  msg.role === "ai"
                    ? "bg-[#FAFAF8] text-[#141412] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]"
                    : "bg-[#141412]/60 text-[#FAFAF8] rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && (
            <div className="flex gap-[8px]">
              <div className="w-[22px] h-[22px] rounded-full bg-[#C9A84C] flex items-center justify-center text-[9px] shrink-0 font-semibold">
                FA
              </div>
              <div className="px-[12px] py-[10px] bg-[#FAFAF8] rounded-[2px_10px_10px_10px] flex items-center gap-[4px]">
                <div className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce" />
                <div
                  className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[#FAFAF8]/10 px-[16px] py-[14px]">
          <div className="flex items-center gap-[8px] p-[6px_10px] bg-[#141412] border border-[#FAFAF8]/15 focus-within:border-[#C9A84C] rounded-[8px] transition">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSend()
              }
              placeholder={`Ask about ${businessName}…`}
              className="flex-1 bg-transparent border-none outline-none text-[#FAFAF8] text-[13px] placeholder:text-[#FAFAF8]/25 px-[4px]"
            />
            <button
              onClick={handleSend}
              disabled={loading || !chatInput.trim()}
              className="w-[28px] h-[28px] bg-[#FAFAF8]/10 hover:bg-[#C9A84C] disabled:opacity-30 disabled:cursor-not-allowed rounded-[6px] border-none flex items-center justify-center cursor-pointer transition"
            >
              <span className="text-[14px] text-[#FAFAF8]">↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
