"use client";

import { useRef, useEffect } from "react";
import { RevenueChart } from "./RevenueChart";
import type { ChartDataPoint } from "@/lib/types";
import type { ProductMetric, ProductSignal, MetricsSummary } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────
const rm = (v: string | number | undefined) =>
  v !== undefined && v !== null
    ? `RM ${parseFloat(String(v)).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const pct = (v: string | number | undefined) =>
  v !== undefined && v !== null ? `${parseFloat(String(v)).toFixed(1)}%` : "—";

const currentMonthLabel = () =>
  new Date().toLocaleString("en-MY", { month: "long", year: "numeric" });

// ─── sub-components ─────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  delta,
  highlight,
}: {
  label: string;
  value: string;
  delta?: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] p-[16px_20px] border ${
        highlight
          ? "bg-[#FDF6E3] border-[#E8D9A0]"
          : "bg-[#FAFAF8] border-[#E8E7E2]"
      }`}
    >
      <div className="text-[10px] font-semibold text-[#9E9D97] uppercase tracking-[0.08em] mb-[6px]">
        {label}
      </div>
      <div className="font-serif text-[22px] text-[#141412] leading-none">
        {value}
      </div>
      {delta && (
        <div className="text-[11px] text-[#6B6A64] mt-[6px]">{delta}</div>
      )}
    </div>
  );
}

function SignalIcon({ action }: { action: string }) {
  const a = action.toUpperCase();
  if (a === "BOOST")
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1L8 5H11L8.5 7.5L9.5 11L6 9L2.5 11L3.5 7.5L1 5H4L6 1Z" fill="#2D7A4F" />
      </svg>
    );
  if (a === "REPRICE")
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1V11M3 4L6 1L9 4" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="#C0584A" strokeWidth="1.5" />
      <path d="M6 4V6.5M6 8.5V8" stroke="#C0584A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── props ───────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "ai";
  text: string;
}

interface FinancePageProps {
  // data
  hasData: boolean;
  loading: boolean;
  error: string | null;
  businessName: string;
  marketplace?: string;
  days: number;
  summary: MetricsSummary | null;
  products: ProductMetric[];
  signals: ProductSignal[];
  chartData: ChartDataPoint[];
  revenueDelta: string | null;
  costDeltaRaw: number | null;
  // chat
  messages: Message[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSend: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  // actions
  handleExportCSV: () => void;
  handleGenerateReport: () => void;
  reportLoading: boolean;
}

// ─── main component ───────────────────────────────────────────────────────────
export function FinancePage({
  hasData,
  loading,
  error,
  businessName,
  marketplace,
  days,
  summary,
  products,
  signals,
  chartData,
  revenueDelta,
  costDeltaRaw,
  messages,
  chatInput,
  setChatInput,
  handleSend,
  messagesEndRef,
  handleExportCSV,
  handleGenerateReport,
  reportLoading,
}: FinancePageProps) {
  return (
    // ── OUTER SHELL: full-height two-column layout ───────────────────────────
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ── LEFT: topbar + scrollable content ────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">

        {/* TOPBAR */}
        <div className="p-[16px_28px] flex items-center justify-between border-b border-[#E8E7E2] bg-[#FAFAF8] shrink-0 z-10">
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

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-0">
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

            {/* No data */}
            {!hasData && !loading && !error && (
              <div className="h-[400px] flex flex-col items-center justify-center text-center gap-[8px]">
                <div className="text-[32px] opacity-30">◈</div>
                <p className="text-[14px] font-medium text-[#141412]">No financial data yet</p>
                <p className="text-[12px] text-[#6B6A64] max-w-[320px]">
                  Connect Printify and fulfil at least one order to start seeing analysis here.
                </p>
              </div>
            )}

            {hasData && (
              <>
                {/* METRIC CARDS */}
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
                        ? `${costDeltaRaw >= 0 ? "↑" : "↓"} ${Math.abs(costDeltaRaw).toFixed(1)}% vs ${
                            chartData[chartData.length - 2]?.month ?? "prev"
                          }`
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
                            const cur = parseFloat(summary?.overall_margin_pct ?? "0");
                            return `${cur >= 30 ? "Healthy" : "Below target"} · target 30%+`;
                          })()
                        : null
                    }
                  />
                </div>

                {/* CHART + SIGNALS — full width side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mb-[16px]">
                  {/* Revenue chart */}
                  <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] h-[220px] flex flex-col">
                    <div className="font-serif text-[16px] text-[#141412] mb-[4px]">Monthly Revenue</div>
                    <div className="text-[11px] text-[#6B6A64] mb-[8px]">
                      {chartData.length > 0
                        ? `Last ${chartData.length} months · ${
                            marketplace
                              ? marketplace.charAt(0).toUpperCase() + marketplace.slice(1)
                              : "all channels"
                          }`
                        : "No history available"}
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                      <RevenueChart chartData={chartData} />
                    </div>
                  </div>

                  {/* Agent Signals */}
                  <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] h-[220px] flex flex-col overflow-hidden">
                    <div className="font-serif text-[16px] text-[#141412] mb-[12px] flex items-center justify-between shrink-0">
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
                      <div className="flex flex-col gap-[10px] overflow-y-auto flex-1 pr-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#E8E7E2] [&::-webkit-scrollbar-thumb]:rounded-full">
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
                                  <span className="text-[9px] text-[#C0584A] font-medium">● HIGH</span>
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
                        <p className="text-[12px] text-[#6B6A64]">No active signals at the moment.</p>
                        <p className="text-[11px] text-[#C4C3BC]">Signals appear when margin thresholds are breached.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* PRODUCT PERFORMANCE TABLE */}
                <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] overflow-hidden">
                  <div className="px-[20px] py-[16px] border-b border-[#E8E7E2] flex items-center justify-between">
                    <div className="font-serif text-[16px] text-[#141412]">Product Performance</div>
                    <div className="text-[11px] text-[#6B6A64]">
                      {summary?.total_orders ?? 0} total orders · last {days} days
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E8E7E2]">
                          {["Product", "Units Sold", "Revenue", "Printify Cost", "Profit", "Margin", "Signal"].map((h) => (
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
                              const productSignal = signals.find((s) => s.product_id === p.product_id);
                              const marginNum = parseFloat(p.margin_pct);
                              return (
                                <tr
                                  key={p.product_id}
                                  className="hover:bg-[#F4F3EF] border-b border-[#E8E7E2] last:border-b-0 transition-colors"
                                >
                                  <td className="px-[20px] py-[12px] font-medium text-[#141412] text-[13px] max-w-[200px]">
                                    <div className="truncate">{p.title}</div>
                                    <div className="text-[10px] text-[#9E9D97] font-normal">{p.product_id}</div>
                                  </td>
                                  <td className="px-[20px] py-[12px] text-[13px] text-[#6B6A64]">{p.units_sold}</td>
                                  <td className="px-[20px] py-[12px] text-[13px]">{rm(p.revenue)}</td>
                                  <td className="px-[20px] py-[12px] text-[13px] text-[#6B6A64]">{rm(p.cost)}</td>
                                  <td
                                    className={`px-[20px] py-[12px] text-[13px] font-semibold ${
                                      p.profit < 0 ? "text-[#C0584A]" : "text-[#2D7A4F]"
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
                                          productSignal.action.toUpperCase() === "BOOST"
                                            ? "bg-[#D1FAE5] text-[#2D7A4F]"
                                            : productSignal.action.toUpperCase() === "REPRICE"
                                              ? "bg-[#FEF3C7] text-[#D97706]"
                                              : "bg-[#FEE2E2] text-[#C0584A]"
                                        }`}
                                      >
                                        <SignalIcon action={productSignal.action} />
                                        {productSignal.action.toUpperCase()}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[#C4C3BC]">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-[20px] py-[24px] text-center">
                              <div className="text-[24px] opacity-20 mb-[6px]">◈</div>
                              <p className="text-[13px] text-[#6B6A64]">No product data available yet.</p>
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
      </div>

      {/* ── RIGHT: STICKY CHAT PANEL (VS Code Copilot style) ─────────────── */}
      <div className="w-[360px] shrink-0 border-l border-[#E8E7E2] bg-[#2A2A27] flex flex-col min-h-0 overflow-hidden">

        {/* Chat header — same height as topbar */}
        <div className="p-[16px_20px] flex items-center gap-[10px] border-b border-[#FAFAF8]/10 shrink-0">
          <div className="w-[30px] h-[30px] rounded-[8px] bg-[#C9A84C] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-bold text-[#FAFAF8]">◈</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#FAFAF8]">Finance Agent</div>
            <div className="text-[10px] text-[#FAFAF8]/40 mt-[1px]">
              {currentMonthLabel()} · {businessName}
            </div>
          </div>
          {loading && (
            <div className="flex items-center gap-[4px]">
              <div className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce" />
              <div className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-[4px] h-[4px] bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-[14px] px-[16px] flex flex-col gap-[12px] min-h-0 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#FAFAF8]/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-[6px] text-center px-[8px] h-full">
              <div className="text-[28px] opacity-20">◈</div>
              <p className="text-[12px] text-[#FAFAF8]/40">
                Finance Agent is ready. Ask about margins, signals, or product performance.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-[8px] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
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
                className={`px-[12px] py-[10px] text-[13px] leading-relaxed max-w-[85%] whitespace-pre-line ${
                  msg.role === "ai"
                    ? "bg-[#FAFAF8] text-[#141412] rounded-[2px_10px_10px_10px]"
                    : "bg-[#141412]/60 text-[#FAFAF8] rounded-[10px_2px_10px_10px]"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && (
            <div className="flex gap-[8px]">
              <div className="w-[22px] h-[22px] rounded-full bg-[#C9A84C] flex items-center justify-center text-[9px] shrink-0 font-semibold text-[#FAFAF8]">
                FA
              </div>
              <div className="px-[12px] py-[10px] bg-[#FAFAF8] rounded-[2px_10px_10px_10px] flex items-center gap-[4px]">
                <div className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce" />
                <div className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-[4px] h-[4px] bg-[#2A2A27] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[#FAFAF8]/10 p-[12px_16px]">
          <div className="flex items-center gap-[8px] p-[6px_10px] bg-[#141412] border border-[#FAFAF8]/15 focus-within:border-[#C9A84C] rounded-[8px] transition">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
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
