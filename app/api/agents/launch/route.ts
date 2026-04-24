import { NextResponse } from 'next/server';
import { runLaunchAgent, pollPublishStatus } from '@/lib/agents/launch/launchAgent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, productId, productData, shopId, userMessage = null } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    if (!productData?.name || !productData?.description || !Array.isArray(productData?.categories)) {
      return NextResponse.json(
        {
          error:
            'productData is required and must include name, description, and categories array.',
        },
        { status: 400 }
      );
    }

    const resolvedProductId =
      typeof productId === 'string' && productId.trim().length > 0
        ? productId
        : crypto.randomUUID();

    const result = await runLaunchAgent({
      businessId,
      productId: resolvedProductId,
      productData,
      shopId: shopId || undefined,
      userMessage,
    });

    // If publish was fired but hasn't completed, poll in the background
    if (result.launch_id && result.publish_result?.publish_status === 'publishing') {
      pollPublishStatus(result.launch_id).catch(() => {});
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API] Launch Agent Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
