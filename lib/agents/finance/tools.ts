import type { ToolState, PrintifyOrder, PrintifyResponse, ProductMetric, Metrics, ProductSignal, Alert } from "@/lib/types";
interface FetchPrintifyOrdersParams {
  printifyToken: string;
  shopId: string;
  days?: number;
  toolState?: ToolState;
}

interface CalculateProfitMetricsParams {
  toolState?: ToolState;
}

interface DetectAnomaliesParams {
  toolState?: ToolState;
}

// ─── Tool 1: Fetch Printify Orders ────────────────────────────────────────────
export async function fetchPrintifyOrders({
  printifyToken,
  shopId,
  days = 30,
  toolState,
}: FetchPrintifyOrdersParams): Promise<{
  status: string;
  order_count: number;
  period_days: number;
  message: string;
}> {
  const orders: PrintifyOrder[] = [];
  let page = 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  while (true) {
    let response: Response;
    try {
      const url = new URL(
        `https://api.printify.com/v1/shops/${shopId}/orders.json`,
      );
      url.searchParams.append("limit", "10");
      url.searchParams.append("page", String(page));
      url.searchParams.append("status", "fulfilled");

      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429) {
        throw { status: 429 };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: unknown) {
      // Handle 429 rate limit — wait 1s and retry once
      const error = err as { status?: number };
      if (error.status === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        const url = new URL(
          `https://api.printify.com/v1/shops/${shopId}/orders.json`,
        );
        url.searchParams.append("limit", "10");
        url.searchParams.append("page", String(page));
        url.searchParams.append("status", "fulfilled");

        response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${printifyToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        throw err;
      }
    }

    const data: PrintifyResponse = await response.json();
    const { data: pageOrders, current_page, last_page } = data;

    // Filter to the requested date range
    const filtered = pageOrders.filter((order: PrintifyOrder) => {
      const created = new Date(order.created_at);
      return created >= cutoff;
    });

    orders.push(...filtered);

    // Stop if we've gone past our date window or reached last page
    if (current_page >= last_page || filtered.length < pageOrders.length) break;
    page++;

    await new Promise((r) => setTimeout(r, 200));
  }


  if (toolState) toolState.orders = orders;

  // Return only a slim summary to GLM — never the raw array
  return {
    status: "ready",
    order_count: orders.length,
    period_days: days,
    message:
      orders.length === 0
        ? "No fulfilled orders found in this period. calculateProfitMetrics will return empty results."
        : `Fetched ${orders.length} fulfilled orders. Call calculateProfitMetrics next (no arguments needed).`,
  };
}

// ─── Tool 2: Calculate Profit Metrics ─────────────────────────────────────────
export function calculateProfitMetrics({
  toolState,
}: CalculateProfitMetricsParams): Metrics {
  // Read from server-side memory, not from GLM-passed args
  const orders = toolState?.orders || [];

  if (orders.length === 0) {
    const emptyMetrics: Metrics = {
      summary: {
        total_orders: 0,
        total_revenue: "0.00",
        total_costs: "0.00",
        total_profit: "0.00",
        overall_margin_pct: "0.0",
      },
      by_product: [],
      note: "No orders in this period — metrics are empty.",
    };
    if (toolState) toolState.metrics = emptyMetrics;
    return emptyMetrics;
  }

  const byProduct: Record<string, ProductMetric> = {};
  let totalRevenue = 0;
  let totalCosts = 0;

  for (const order of orders) {

    const orderRevenue = order.total_price / 100; 
    let orderCost = 0;

    for (const item of order.line_items) {
      const itemCost = ((item.cost || 0) + (item.shipping_cost || 0)) / 100;
      const itemRevenue = (item.metadata?.price || 0) / 100;
      const productId = item.product_id;
      const productTitle = item.metadata?.title || "Unknown Product";

      orderCost += itemCost;

      if (!byProduct[productId]) {
        byProduct[productId] = {
          product_id: productId,
          title: productTitle,
          units_sold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin_pct: "0",
        };
      }

      byProduct[productId].units_sold += item.quantity || 1;
      byProduct[productId].revenue += itemRevenue;
      byProduct[productId].cost += itemCost;
    }

    totalRevenue += orderRevenue;
    totalCosts += orderCost;
  }

  const productList: ProductMetric[] = Object.values(byProduct)
    .map((p) => {
      p.profit = p.revenue - p.cost;
      p.margin_pct =
        p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0.0";
      return p;
    })
    .sort((a, b) => b.profit - a.profit); // sort best → worst

  const totalProfit = totalRevenue - totalCosts;
  const overallMargin =
    totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const metrics: Metrics = {
    summary: {
      total_orders: orders.length,
      total_revenue: totalRevenue.toFixed(2),
      total_costs: totalCosts.toFixed(2),
      total_profit: totalProfit.toFixed(2),
      overall_margin_pct: overallMargin,
    },
    by_product: productList,
  };

  if (toolState) toolState.metrics = metrics;

  return metrics;
}

// ─── Tool 3: Detect Anomalies & Generate Signals ─────────────────────────────

export function detectAnomalies({ toolState }: DetectAnomaliesParams): {
  signals: ProductSignal[];
  alerts: Alert[];
  error?: string;
} {

  const metrics = toolState?.metrics;
  if (!metrics)
    return {
      signals: [],
      alerts: [],
      error: "metrics not computed yet — call calculateProfitMetrics first",
    };

  const signals: ProductSignal[] = [];
  const alerts: Alert[] = [];

  const DEMO_MODE = process.env.DEMO_MODE === "true";
  const THRESHOLDS = DEMO_MODE
    ? { reprice: 30, retire: 15, boost_margin: 35, boost_units: 1 }
    : { reprice: 10, retire: 5, boost_margin: 40, boost_units: 10 };

  for (const product of metrics.by_product) {
    const margin = parseFloat(product.margin_pct);

    // Rule: margin below reprice threshold
    if (margin > 0 && margin < THRESHOLDS.reprice) {
      signals.push({
        type: "product_signal",
        action: "reprice",
        product_id: product.product_id,
        product_title: product.title,
        reason: `Margin is ${margin}% — below ${THRESHOLDS.reprice}% threshold`,
        suggested_price_multiplier: 1.35,
        priority: margin < THRESHOLDS.retire ? "CRITICAL" : "HIGH",
      });
    }

    // Rule: margin below retire threshold (also gets a reprice signal above)
    if (margin > 0 && margin < THRESHOLDS.retire) {
      signals.push({
        type: "product_signal",
        action: "retire",
        product_id: product.product_id,
        product_title: product.title,
        reason: `Margin is ${margin}% — critically low`,
        priority: "HIGH",
      });
    }

    // Rule: high-margin product → boost
    if (
      margin >= THRESHOLDS.boost_margin &&
      product.units_sold >= THRESHOLDS.boost_units
    ) {
      signals.push({
        type: "product_signal",
        action: "boost",
        product_id: product.product_id,
        product_title: product.title,
        reason: `High-margin (${margin}%) with ${product.units_sold} units sold`,
        priority: "MEDIUM",
      });
    }

    if (product.units_sold === 1 && product.profit <= 0) {
      alerts.push({
        type: "low_volume_loss",
        product_id: product.product_id,
        product_title: product.title,
        message: `Only 1 unit sold and already unprofitable (RM ${product.profit.toFixed(2)}). Consider repricing or retiring before promoting.`,
      });
    }
  }

  // Rule: overall profit negative
  const totalProfit = parseFloat(metrics.summary.total_profit);
  if (totalProfit < 0) {
    alerts.push({
      type: "negative_profit",
      severity: "CRITICAL",
      message: `Store is operating at a loss: ${metrics.summary.total_profit}`,
    });
  }

  // Storing back to toolState for Finance Agent final step
  if (toolState) {
    toolState.signals = signals;
    toolState.alerts = alerts;
  }

  return { signals, alerts };
}

// ─── Tool registry for GLM function calling ──────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "fetchPrintifyOrders",
      description:
        "Fetches fulfilled orders from Printify for the configured time period. Call this FIRST. Returns a count summary only — full data is handled server-side.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description:
              "Number of past days to fetch. Default is already configured — only pass this if user explicitly asked for a different period.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateProfitMetrics",
      description:
        "Computes P&L, margin, and per-product breakdown. Call after fetchPrintifyOrders. Takes NO arguments — data is pre-loaded server-side.",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detectAnomalies",
      description:
        "Runs rule-based analysis and generates signals for other agents. Call after calculateProfitMetrics. Takes NO arguments — uses pre-computed metrics server-side.",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];
