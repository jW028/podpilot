## Table `brand_profiles`

Business Prompting Agent output — brand identity and Printify account setup status.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  Unique |
| `brand_name` | `text` |  |
| `tagline` | `text` |  Nullable |
| `brand_voice` | `text` |  Nullable |
| `target_audience` | `text` |  Nullable |
| `color_palette` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `printify_setup_status` | `text` |  |
| `printify_shop_id` | `text` |  Nullable |

## Table `businesses`

Core table — one row per POD store. Owned by a Supabase auth user. Includes Printify shop connection fields.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `name` | `text` |  |
| `niche` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `printify_shop_id` | `text` |  Nullable |
| `printify_pat_hint` | `text` |  Nullable |
| `marketplace` | `text` |  Nullable |
| `store_url` | `text` |  Nullable |

## Table `finance_snapshots`

Finance Agent — daily cached analysis results from Printify order data.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `snapshot_date` | `date` |  |
| `period` | `text` |  |
| `metrics` | `jsonb` |  Nullable |
| `insights` | `text` |  Nullable |
| `signals` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `products`

Product Agent + Launch Agent — products created and pushed to Printify.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `printify_product_id` | `text` |  Nullable Unique |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `niche` | `text` |  Nullable |
| `design_prompt` | `text` |  Nullable |
| `design_url` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `tickets`

Customer Service Agent — inbound inquiries. messages[] stored as JSONB array.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `product_id` | `uuid` |  Nullable |
| `channel` | `text` |  |
| `issue_type` | `text` |  |
| `priority` | `text` |  |
| `status` | `text` |  |
| `resolved_by` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `messages` | `jsonb` |  |

## Table `workflows`

Inter-agent message bus — all agents read/write here for coordination.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `type` | `text` |  |
| `source_agent` | `text` |  |
| `target_agent` | `text` |  Nullable |
| `payload` | `jsonb` |  |
| `state` | `text` |  |
| `error_message` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `processed_at` | `timestamptz` |  Nullable |

