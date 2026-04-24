import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveBusinessPrintifyToken } from '@/lib/printify/credentials';

type PrintifyShop = {
  id: string | number;
  title?: string;
  sales_channel?: string;
};

type SalesChannel = {
  shop_id: string;
  title: string;
  channel: string;
};

export async function POST(request: Request) {
  try {
    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get Printify token from encrypted business credential (or env fallback)
    const { data: business } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    const printifyToken = await resolveBusinessPrintifyToken(supabase, businessId);

    if (!printifyToken) {
      return NextResponse.json(
        { error: 'No Printify token available. Connect Printify first.' },
        { status: 400 }
      );
    }

    // Fetch shops from Printify
    console.log('[Refresh Channels] Token prefix:', printifyToken.slice(0, 10), '... length:', printifyToken.length);
    const shopsRes = await fetch('https://api.printify.com/v1/shops.json', {
      headers: { Authorization: `Bearer ${printifyToken}` },
    });

    if (!shopsRes.ok) {
      const errText = await shopsRes.text();
      console.error('[Refresh Channels] Printify API error:', shopsRes.status, errText);
      return NextResponse.json(
        { error: `Printify API error: ${errText}` },
        { status: 502 }
      );
    }

    const shopsData = await shopsRes.json() as { data?: PrintifyShop[] } | PrintifyShop[];
    const shops = Array.isArray(shopsData) ? shopsData : (shopsData.data || []);
    console.log(`[Refresh Channels] Found ${shops.length} shop(s):`, JSON.stringify(shops.map((s) => ({ id: s.id, title: s.title, sales_channel: s.sales_channel }))));

    const salesChannels: SalesChannel[] = shops.map((shop) => ({
      shop_id: String(shop.id),
      title: shop.title || '',
      channel: shop.sales_channel || 'disconnected',
    }));

    // Update business record
    const primaryShop = shops[0];
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        sales_channels: salesChannels,
        printify_shop_id: primaryShop ? String(primaryShop.id) : null,
        marketplace: primaryShop?.sales_channel || primaryShop?.title || null,
      })
      .eq('id', businessId);

    if (updateError) {
      console.error('[Refresh Channels] Supabase update error:', updateError.message);
      return NextResponse.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
    }
    console.log('[Refresh Channels] Updated sales_channels for business', businessId);

    return NextResponse.json({ channels: salesChannels }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[API] Refresh Channels Error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
