```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.brand_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE,
  brand_name text NOT NULL,
  tagline text,
  brand_voice text,
  target_audience text,
  color_palette jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  printify_setup_status text NOT NULL DEFAULT 'pending'::text CHECK (printify_setup_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'created'::text, 'failed'::text])),
  printify_shop_id text,
  CONSTRAINT brand_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT brand_profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  niche text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  printify_shop_id text,
  printify_pat_hint text,
  marketplace text DEFAULT 'etsy'::text,
  store_url text,
  sales_channels jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.finance_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  period text NOT NULL DEFAULT '30d'::text,
  metrics jsonb,
  insights text,
  signals jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT finance_snapshots_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_launch_id uuid NOT NULL,
  order_number text,
  external_order_id text,
  channel text NOT NULL DEFAULT 'etsy'::text CHECK (channel = ANY (ARRAY['etsy'::text, 'shopify'::text, 'manual'::text])),
  customer_name text,
  customer_email text,
  shipping_address jsonb,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric,
  shipping_cost numeric,
  total_amount numeric,
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'in_production'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text])),
  tracking_number text,
  printify_order_id text,
  ordered_at timestamp with time zone,
  fulfilled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT orders_product_launch_id_fkey FOREIGN KEY (product_launch_id) REFERENCES public.product_launches(id)
);

CREATE TABLE public.product_launches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  business_id uuid NOT NULL,
  printify_product_id text,
  external_product_id text,
  optimal_prices jsonb,
  pricing_reasoning text,
  pricing_confidence double precision,
  market_research_summary text,
  publish_status text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'created'::text, 'published'::text, 'failed'::text])),
  launched_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_launches_pkey PRIMARY KEY (id),
  CONSTRAINT product_launches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_launches_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  attributes jsonb,
  design_path text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'designing'::text, 'ready'::text, 'pushed'::text, 'published'::text, 'retired'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  price real DEFAULT '0'::real,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  order_id uuid,
  channel text NOT NULL DEFAULT 'manual'::text CHECK (channel = ANY (ARRAY['etsy'::text, 'shopify'::text, 'email'::text, 'manual'::text])),
  issue_type text NOT NULL DEFAULT 'general'::text CHECK (issue_type = ANY (ARRAY['wrong_item'::text, 'print_quality'::text, 'not_received'::text, 'sizing'::text, 'refund_request'::text, 'review'::text, 'feedback'::text, 'general'::text])),
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'ai_replied'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])),
  resolved_by text CHECK (resolved_by = ANY (ARRAY['ai'::text, 'human'::text, NULL::text])),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT support_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  type text NOT NULL,
  source_agent text NOT NULL CHECK (source_agent = ANY (ARRAY['business_prompting_agent'::text, 'design_agent'::text, 'launch_agent'::text, 'customer_service_agent'::text, 'finance_agent'::text])),
  target_agent text CHECK (target_agent IS NULL OR (target_agent = ANY (ARRAY['business_prompting_agent'::text, 'design_agent'::text, 'launch_agent'::text, 'customer_service_agent'::text, 'finance_agent'::text]))),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending'::text CHECK (state = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'failed'::text])),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT workflows_pkey PRIMARY KEY (id),
  CONSTRAINT workflows_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```
