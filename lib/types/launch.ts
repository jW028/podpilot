export type LaunchProductInput = {
  name: string;
  description: string;
  categories: string[];
  image_prompt?: string;
  tags?: string[];
};

export type SuggestedPrices = {
  tshirt: number;
  mug: number;
  hoodie: number;
  [key: string]: number;
};

export type PricingDecision = {
  suggested_prices: SuggestedPrices;
  reasoning: string;
  confidence: number;
};

export type PrintifyResult = {
  success: boolean;
  product_id: string;
  status?: string;
  printify_url?: string;
  prices_used?: SuggestedPrices;
  note?: string;
  published?: boolean;
  publish_status?: string;
  external_product_id?: string;
  [key: string]: unknown;
};

export type DesignToLaunchPayload = {
  productName: string;
  description: string;
  blueprintId: number;
  printProviderId?: number;
  variantIds?: number[];
  prices: Record<string, number>;
  pricingReasoning?: string;
  tags?: string[];
  categories: string[];
};
