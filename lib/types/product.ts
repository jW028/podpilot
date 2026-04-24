export type Product = {
  id: string;
  business_id: string;
  printify_product_id: string | null;
  title: string;
  description: string | null;
  niche: string | null;
  design_prompt: string | null;
  design_url: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

export type ProductLaunch = {
  id: string;
  product_id: string;
  business_id: string;
  printify_product_id: string | null;
  external_product_id: string | null;
  optimal_prices: Record<string, number> | null;
  pricing_reasoning: string | null;
  pricing_confidence: number | null;
  market_research_summary: string | null;
  publish_status: string | null;
  status: string;
  launched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProductInput = {
  title: string;
  description?: string;
  niche?: string;
  design_prompt?: string;
  design_url?: string;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  status?: "draft" | "published" | "archived";
};
