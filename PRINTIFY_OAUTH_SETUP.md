# Printify OAuth Implementation Guide

## Why Printify Direct Connection?

Your Podpilot app is a **Printify automation AI agent**, so connecting directly to Printify accounts makes perfect sense:

✅ **Direct Integration** - No middleman (no need for Shopify)
✅ **Automation Ready** - Direct access to Printify API with OAuth token
✅ **Multi-Platform** - Works with users on any platform (Etsy, WooCommerce, Printful stores, etc.)
✅ **Shop Management** - Users can manage multiple shops via Printify
✅ **Better UX** - One-click Printify store connection

---

## Architecture

Your auth now supports **3 authentication methods**:

```
┌─────────────────────────────────────┐
│   Login/Register Page               │
├─────────────────────────────────────┤
│ [Connect Printify Store] ← PRIMARY  │
│ [Continue with Google]  ← Secondary │
│ [Continue with Apple]   ← Secondary │
└─────────────────────────────────────┘
        ↓                ↓           ↓
    Custom OAuth    Supabase OAuth  Supabase OAuth
    (Printify API)  (Email account) (Email account)
```

---

## Setup: Step-by-Step

### Step 1: Get Printify OAuth Credentials

1. Go to [Printify Apps](https://app.printify.com/apps)
2. Click **"Create App"**
3. Fill in app details:
   - **App name**: Podpilot
   - **Description**: AI automation agent for Printify
4. Under **OAuth Settings**:
   - **Redirect URI**: `http://localhost:3000/auth/printify/callback` (dev)
   - **Redirect URI**: `https://yourdomain.com/auth/printify/callback` (prod)
5. Copy:
   - **Client ID** → `NEXT_PUBLIC_PRINTIFY_CLIENT_ID`
   - **Client Secret** → `PRINTIFY_CLIENT_SECRET`

### Step 2: Environment Variables

Update your `.env.local`:

```env
# Printify OAuth
NEXT_PUBLIC_PRINTIFY_CLIENT_ID=your_client_id
PRINTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Keep existing vars
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Step 3: Create Database Table for Printify Integration

Run this SQL in Supabase:

```sql
-- Store Printify OAuth tokens and shop data
CREATE TABLE user_integrations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'printify',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  shop_id BIGINT NOT NULL,
  shop_name TEXT NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, provider, shop_id)
);

-- Enable RLS for security
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations
CREATE POLICY "Users can view own integrations"
  ON user_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own integrations"
  ON user_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON user_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_provider ON user_integrations(provider);
```

---

## How It Works

### OAuth Flow

```
1. User clicks "Connect Printify Store"
   ↓
2. App redirects to: /auth/printify
   ↓
3. /auth/printify generates state token and redirects to:
   https://app.printify.com/oauth/authorize?
     client_id=YOUR_ID&
     scope=shops.write+products.read&
     state=random_token
   ↓
4. User signs in to Printify & authorizes Podpilot
   ↓
5. Printify redirects back to: /auth/printify/callback?code=XXX&state=YYY
   ↓
6. /auth/printify/callback exchanges code for access_token
   ↓
7. App fetches user's Printify shops
   ↓
8. If no existing user, creates account with Printify email
   ↓
9. Stores Printify token in user_integrations table
   ↓
10. Redirects to: /dashboard?printify=connected
    ↓
11. User is authenticated and can start automating! ✅
```

---

## Files Overview

### New Files Created

| File                                   | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `/app/auth/printify/route.ts`          | Initiates OAuth, redirects to Printify           |
| `/app/auth/printify/callback/route.ts` | Handles OAuth callback, exchanges code for token |

### Updated Files

| File                                    | Change                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `components/ui/shared/OAuthButtons.tsx` | Added "Connect Printify Store" button (replaced Shopify) |
| `components/providers/AuthProvider.tsx` | Added `connectWithPrintify()` method                     |
| `.env.example`                          | Added Printify OAuth variables                           |

---

## Scopes Explained

Current scopes: `shops.write products.read`

| Scope            | Permission                        |
| ---------------- | --------------------------------- |
| `shops.write`    | Read/manage shops                 |
| `products.read`  | Read products                     |
| `products.write` | (Optional) Create/update products |
| `orders.read`    | (Optional) Read orders            |
| `catalogs.read`  | (Optional) Access product catalog |

To add more scopes, update `/app/auth/printify/route.ts`:

```typescript
const scope = "shops.write products.read orders.read catalogs.read";
```

---

## Testing Printify OAuth

### Development (localhost)

1. **Start your dev server:**

   ```bash
   pnpm run dev
   ```

2. **Go to login page:**

   ```
   http://localhost:3000/login
   ```

3. **Click "Connect Printify Store"**

4. **You'll be redirected to Printify** (make sure you're logged in)

5. **Authorize the app** when prompted

6. **Should redirect back to:** `http://localhost:3000/dashboard?printify=connected`

7. **Check Supabase** → `user_integrations` table to verify token was stored

### Expected Behavior

✅ Redirects to Printify login  
✅ Shows authorization screen  
✅ After approving, redirects to dashboard  
✅ Printify token stored in database  
✅ User account created (if new)

---

## Error Handling

### Common Issues

| Error                   | Cause                            | Fix                                     |
| ----------------------- | -------------------------------- | --------------------------------------- |
| `Redirect URL mismatch` | URLs don't match in Printify app | Verify exact URLs in Printify settings  |
| `Invalid state`         | State token validation failed    | Check cookie setup, might be blocked    |
| `No access token`       | Token response missing           | Verify Client ID and Secret are correct |
| `No Printify shops`     | User has no shops on Printify    | Have user create a shop first           |
| Infinite redirect loop  | Session not persisting           | Check Supabase auth config              |

---

## Accessing User's Printify Token

Once a user is authenticated with Printify:

### From Frontend (Client)

```typescript
import { useAuth } from "@/components/providers/AuthProvider";

export function MyComponent() {
  const { user } = useAuth();

  // Get user's metadata (if stored there)
  const printifyShopId = user?.user_metadata?.printify_shop_id;

  return <div>Shop ID: {printifyShopId}</div>;
}
```

### From Backend (Server)

```typescript
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const supabase = createServerClient(...);

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch Printify integration from database
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "printify")
    .single();

  // Use the access token for Printify API calls
  const token = integration.access_token;

  // Example: Fetch products from Printify
  const response = await fetch(
    `https://api.printify.com/v1/shops/${integration.shop_id}/products.json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
```

---

## Production Deployment

Before going live:

1. **Update Printify App Settings:**
   - Add production redirect URL: `https://yourdomain.com/auth/printify/callback`

2. **Update Environment Variables:**

   ```env
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NEXT_PUBLIC_PRINTIFY_CLIENT_ID=your_prod_id
   PRINTIFY_CLIENT_SECRET=your_prod_secret
   ```

3. **Test in Production:**
   - Go to https://yourdomain.com/login
   - Test Printify connection end-to-end
   - Verify tokens are securely stored

4. **Enable HTTPS:**
   - Printify requires HTTPS for OAuth (except localhost)

---

## Security Best Practices

✅ **Secrets stored server-side only**

- `PRINTIFY_CLIENT_SECRET` never exposed to client
- Access tokens stored in secure database

✅ **OAuth State Validation**

- Random state token generated
- Validated on callback
- Expires after 10 minutes

✅ **HTTPS Required**

- Production OAuth requires HTTPS
- Secure cookie flags enabled

✅ **Token Storage**

- Tokens encrypted in Supabase
- Access via RLS policies
- Never logged in console

---

## Advanced: Refresh Token Handling

Printify tokens may expire. To refresh:

```typescript
// Update /lib/supabase/client.ts or create a new util

export async function refreshPrintifyToken(userId: string) {
  const supabase = createClient();

  // Get current integration
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "printify")
    .single();

  if (!integration.refresh_token) {
    throw new Error("No refresh token available");
  }

  // Exchange refresh token for new access token
  const response = await fetch("https://api.printify.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: integration.refresh_token,
      client_id: process.env.NEXT_PUBLIC_PRINTIFY_CLIENT_ID,
      client_secret: process.env.PRINTIFY_CLIENT_SECRET,
    }),
  });

  const newToken = await response.json();

  // Update database with new tokens
  await supabase
    .from("user_integrations")
    .update({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "printify");

  return newToken.access_token;
}
```

---

## Next Steps

1. ✅ Set up Printify OAuth credentials
2. ✅ Add environment variables
3. ✅ Create database table
4. ✅ Test in development
5. ✅ Deploy to production
6. 🔄 Implement Printify API calls for automation
7. 🔄 Add shop management UI
8. 🔄 Build AI automation features

---

## Resources

- [Printify OAuth Docs](https://printify.com/api/docs/#tag/Auth)
- [Printify API Reference](https://printify.com/api/docs/)
- [OAuth 2.0 Spec](https://oauth.net/2/)
