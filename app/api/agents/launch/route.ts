import { NextResponse } from 'next/server';

import { runLaunchAgent } from '@/lib/agents/launch/launchAgent';
import type { DesignToLaunchPayload } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      businessId,
      productId,
      productData,
      userMessage = null,
      designPayload,
      salesChannelIds,
    }: {
      businessId: string;
      productId: string;
      productData: unknown;
      userMessage?: string | null;
      designPayload?: DesignToLaunchPayload;
      salesChannelIds?: string[];
    } = body;

    if (!businessId || !productId || !productData) {
      return NextResponse.json(
        { error: 'businessId, productId, and productData are required.' },
        { status: 400 },
      );
    }

    const result = await runLaunchAgent({
      businessId,
      productId,
      productData: productData as Parameters<typeof runLaunchAgent>[0]['productData'],
      userMessage,
      designPayload,
      salesChannelIds,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('[API] Launch Agent Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
