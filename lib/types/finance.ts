import type { ProductSignal, Alert } from './workflow';

export interface PrintifyLineItem {
  product_id: string;
  quantity: number;
  cost?: number;
  shipping_cost?: number;
  metadata?: {
    title?: string;
    price?: number;
  };
}

export interface PrintifyOrder {
  id: string;
  created_at: string;
  total_price: number;
  line_items: PrintifyLineItem[];
}

export interface PrintifyResponse {
  data: PrintifyOrder[];
  current_page: number;
  last_page: number;
}

export interface ProductMetric {
  product_id: string;
  title: string;
  units_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: string;
}

export interface MetricsSummary {
  total_orders: number;
  total_revenue: string;
  total_costs: string;
  total_profit: string;
  overall_margin_pct: string;
}

export interface Metrics {
  summary: MetricsSummary;
  by_product: ProductMetric[];
  note?: string;
}

export interface ToolState {
  orders?: PrintifyOrder[];
  metrics?: Metrics;
  signals?: ProductSignal[];
  alerts?: Alert[];
}

export type DetectAnomaliesResult = {
  signals: ProductSignal[];
  alerts: Alert[];
  error?: string;
};