import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getGlmClient(): OpenAI {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('Missing GLM_API_KEY');
  return new OpenAI({
    apiKey,
    baseURL: process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, days = 30 } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    const { data: snapshot } = await supabase
      .from('finance_snapshots')
      .select('*')
      .eq('business_id', businessId)
      .eq('period', `${days}d`)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshot found for this business.' }, { status: 404 });
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, marketplace')
      .eq('id', businessId)
      .single();

    const { data: historicalSnapshots } = await supabase
      .from('finance_snapshots')
      .select('snapshot_date, metrics')
      .eq('business_id', businessId)
      .eq('period', '30d')
      .order('snapshot_date', { ascending: true })
      .limit(7);

    const chartData = (historicalSnapshots ?? []).map((row: any, idx: number, arr: any[]) => {
      const date = new Date(row.snapshot_date);
      const month = date.toLocaleString('en-MY', { month: 'short' });
      const revenue = parseFloat(row.metrics?.summary?.total_revenue ?? '0');
      return { month, revenue, isCurrent: idx === arr.length - 1 };
    });

    const reportDate = new Date().toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const context = {
      business: {
        name: business?.name ?? 'Unknown Business',
        marketplace: business?.marketplace ?? 'N/A',
      },
      report_date: reportDate,
      period_days: days,
      summary: snapshot.metrics?.summary ?? {},
      by_product: snapshot.metrics?.by_product ?? [],
      signals: snapshot.signals?.signals ?? snapshot.signals ?? [],
      insights: snapshot.insights ?? '',
      chart_data: chartData,
    };

    const glm = getGlmClient();

    const systemPrompt = `You are a professional financial report writer for a print-on-demand business. Generate a complete, self-contained HTML financial report document using only inline CSS. Follow industry standards. Color scheme: bg #F7F6F2, accent #C9A84C, text #141412. Include: cover section, executive summary, key metrics table, revenue trend (text-based), product performance table, agent signals, strategic recommendations. Use only inline CSS. Be print-friendly. Use the provided data accurately — do not fabricate numbers. Return ONLY the HTML document starting with <!DOCTYPE html>, no markdown fences, no commentary.`;

    const userPrompt = `Generate a complete HTML financial report using this data:\n\n${JSON.stringify(context, null, 2)}`;

    const response = await glm.chat.completions.create({
      model: process.env.GLM_MODEL || 'glm-4.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8192,
      temperature: 0.4,
    });

    let htmlContent = response.choices[0].message.content || '';

    // Strip possible markdown fences
    htmlContent = htmlContent.trim();
    if (htmlContent.startsWith('```html')) {
      htmlContent = htmlContent.slice(7);
    } else if (htmlContent.startsWith('```')) {
      htmlContent = htmlContent.slice(3);
    }
    if (htmlContent.endsWith('```')) {
      htmlContent = htmlContent.slice(0, -3);
    }
    htmlContent = htmlContent.trim();

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `finance-report-${businessId}-${dateStr}.html`;

    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[API] Finance Report Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
