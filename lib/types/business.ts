export type Business = {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  status: "draft" | "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
  printify_shop_id: string | null;
  printify_pat_hint: string | null;
  marketplace: string | null;
  store_url: string | null;
};

export type CreateBusinessInput = {
  name: string;
  niche?: string;
  status?: "draft" | "active";
  marketplace?: string;
};

export type UpdateBusinessInput = Partial<CreateBusinessInput>;
