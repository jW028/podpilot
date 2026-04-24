export type AttributeType = "text" | "textarea" | "number" | "image" | "selection";

export type Attribute = {
  type: AttributeType;
  value: string | number | string[];
  label?: string;
  placeholder?: string;
  options?: string[];
  locked?: boolean;
  required?: boolean;
};

export type ProductAttributes = Record<string, Attribute>;

export type Product = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  attributes: ProductAttributes | null;
  design_path: string | null;
  status: "draft" | "designing" | "ready" | "pushed" | "published" | "retired";
  price: number;
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
  attributes?: ProductAttributes;
  design_path?: string;
  price?: number;
  status?: "draft" | "designing" | "ready" | "pushed" | "published" | "retired";
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  status?: "draft" | "designing" | "ready" | "pushed" | "published" | "retired";
};
