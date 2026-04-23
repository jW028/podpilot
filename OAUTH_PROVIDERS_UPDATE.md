# OAuth Providers Update - Shopify & Apple

## What Changed

Your auth now supports:

- ✅ **Google** (original)
- ✅ **Shopify** (new - for e-commerce store owners)
- ✅ **Apple** (new - for general users)
- ❌ **GitHub** (removed)

---

## Supabase Configuration

### 1. Enable Shopify OAuth

**In Supabase Dashboard:**

1. Go to **Authentication** → **Providers**
2. Find **Shopify** and enable it
3. Add redirect URLs:
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

**Get Shopify Credentials:**

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Create a new app (if you don't have one)
3. Go to **App setup** → **OAuth admin API scopes**
4. Find **OAuth credentials** section
5. Set **Redirect URI**: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback?provider=shopify`
   - Find your project ref in Supabase settings
6. Copy:
   - **Client ID**
   - **Client Secret**
7. Paste them in Supabase Shopify provider settings

**Benefits:**

- Store owners can connect their Shopify stores directly
- Automatic store data sync with Printify
- Streamlined onboarding for e-commerce users

---

### 2. Enable Apple OAuth

**In Supabase Dashboard:**

1. Go to **Authentication** → **Providers**
2. Find **Apple** and enable it
3. Add redirect URLs:
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

**Get Apple Credentials:**

1. Go to [Apple Developer Account](https://developer.apple.com/account/)
2. Go to **Certificates, Identifiers & Profiles**
3. Create a new **Service ID** (not App ID):
   - Use reverse domain: `com.yourcompany.podpilot-auth`
4. Enable **Sign in with Apple**
5. Configure return URLs:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback?provider=apple
   ```
6. Create a **Private Key** for the Service ID
7. Download the key and get:
   - **Team ID** (from Apple account page top-right)
   - **Client ID** (the Service ID identifier)
   - **Key ID** (from the private key)
   - Private key content
8. Paste all in Supabase Apple provider settings

**Benefits:**

- Works on iOS/macOS users
- Premium user experience
- Privacy-focused

---

## Testing

### Test Shopify OAuth

1. Go to http://localhost:3000/login
2. Click **"Connect Shopify Store"**
3. Sign in with Shopify account
4. Should redirect to dashboard

### Test Apple OAuth

1. Go to http://localhost:3000/login
2. Click **"Continue with Apple"**
3. Sign in with Apple ID
4. Should redirect to dashboard

---

## About Printify Direct Integration

**Note:** Supabase doesn't have direct Printify OAuth support. Currently, Shopify is the best option because:

- Users can connect their Shopify stores (which use Printify)
- You can get their Printify token from Shopify's API
- This enables store-level automation

**To add Printify direct login later:**

- Implement custom OAuth flow with Printify API
- Create your own API endpoint that handles Printify auth
- Store Printify token in user metadata

For now, Shopify + Google/Apple covers most use cases.

---

## File Changes Summary

| File                                    | Change                                                |
| --------------------------------------- | ----------------------------------------------------- |
| `components/ui/shared/OAuthButtons.tsx` | Replaced GitHub with Shopify & Apple buttons          |
| `components/providers/AuthProvider.tsx` | Updated provider types to support new OAuth providers |

---

## Environment Variables

No new env variables needed! Supabase handles OAuth configuration.

Make sure you still have:

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

---

## Troubleshooting

| Issue                       | Solution                                                     |
| --------------------------- | ------------------------------------------------------------ |
| "Redirect URL mismatch"     | Check URLs match exactly in Apple/Shopify AND Supabase       |
| "Invalid credentials"       | Verify Client ID and Secret are correct                      |
| Apple sign-in blocked       | Ensure private key is valid and not expired                  |
| Shopify button doesn't work | Check Shopify app is in **development** or **active** status |
