import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { decryptPrintifyToken, encryptPrintifyToken, maskPrintifyToken, normalizePrintifyTokenInput } from '@/lib/printify/credentials';

type PrintifyChannel = {
  shop_id: string;
  title: string;
  channel: string;
};

type PrintifyShop = {
  id: string | number;
  title?: string;
  sales_channel?: string;
};

type OwnedBusiness = {
  id: string;
  user_id: string;
  printify_pat_hint: string | null;
  printify_shop_id: string | null;
  sales_channels: PrintifyChannel[] | null;
};

function isEncryptedTokenValue(value: string) {
  return value.startsWith('enc.v1:');
}

async function getAuthorizedSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    throw new Error('Missing auth token.');
  }

  const authClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    throw new Error('Invalid user session.');
  }

  const serviceClient = createClient(url, serviceRoleKey);

  return { serviceClient, user };
}

async function assertBusinessOwnership(serviceClient: ReturnType<typeof createClient>, businessId: string, userId: string): Promise<OwnedBusiness> {
  const { data: business, error } = await serviceClient
    .from('businesses')
    .select('id, user_id, printify_pat_hint, printify_shop_id, sales_channels')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!business) {
    throw new Error('Business not found.');
  }

  if (business.user_id !== userId) {
    throw new Error('You do not have access to this business.');
  }

  return business as OwnedBusiness;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { serviceClient, user } = await getAuthorizedSupabase(request);
    const business = await assertBusinessOwnership(serviceClient, id, user.id);

    const decryptedToken = business.printify_pat_hint && isEncryptedTokenValue(business.printify_pat_hint)
      ? decryptPrintifyToken(business.printify_pat_hint)
      : null;
    const channels = Array.isArray(business.sales_channels) ? business.sales_channels : [];
    const selectedChannel = channels.find((channel) => channel.shop_id === business.printify_shop_id) || channels[0] || null;
    const isConnected = Boolean(decryptedToken || business.printify_shop_id);

    return NextResponse.json({
      connected: isConnected,
      shopId: selectedChannel?.shop_id || business.printify_shop_id || null,
      shopName: selectedChannel?.title || null,
      tokenHint: decryptedToken ? maskPrintifyToken(decryptedToken) : business.printify_pat_hint || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load Printify connection.';
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { serviceClient, user } = await getAuthorizedSupabase(request);
    await assertBusinessOwnership(serviceClient, id, user.id);

    const body = await request.json();
    const apiKey = normalizePrintifyTokenInput(String(body?.apiKey || ''));

    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required.' }, { status: 400 });
    }

    const encryptedToken = encryptPrintifyToken(apiKey);

    const shopsResponse = await fetch('https://api.printify.com/v1/shops.json', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!shopsResponse.ok) {
      const errorText = await shopsResponse.text();
      if (shopsResponse.status === 401) {
        return NextResponse.json(
          { error: 'Printify authentication failed. Paste your raw Personal Access Token (without the "Bearer" prefix).' },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: `Printify API error: ${errorText}` },
        { status: 502 },
      );
    }

    const shopsData = (await shopsResponse.json()) as { data?: PrintifyShop[] } | PrintifyShop[];
    const shops = Array.isArray(shopsData) ? shopsData : (shopsData.data || []);
    const salesChannels: PrintifyChannel[] = shops.map((shop) => ({
      shop_id: String(shop.id),
      title: shop.title || '',
      channel: shop.sales_channel || 'disconnected',
    }));
    const primaryShop = shops[0];

    const businessUpdate: Record<string, unknown> = {
      printify_pat_hint: encryptedToken,
      sales_channels: salesChannels,
      printify_shop_id: primaryShop ? String(primaryShop.id) : null,
      marketplace: primaryShop?.sales_channel || primaryShop?.title || null,
    };

    await serviceClient.from('businesses').update(businessUpdate).eq('id', id).throwOnError();

    return NextResponse.json({
      success: true,
      tokenHint: maskPrintifyToken(apiKey),
      shopId: primaryShop ? String(primaryShop.id) : null,
      shopName: primaryShop?.title || null,
      channels: salesChannels,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to save Printify connection.';
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
