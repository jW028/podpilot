import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

// Give this route up to 60s — Puppeteer needs time to launch Chromium
export const maxDuration = 60;

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

    // ── Fetch business info ─────────────────────────────────────────────
    const { data: business } = await supabase
      .from('businesses')
      .select('name, marketplace')
      .eq('id', businessId)
      .single();

    // ── Fetch latest snapshot ───────────────────────────────────────────
    const { data: snapshot } = await supabase
      .from('finance_snapshots')
      .select('*')
      .eq('business_id', businessId)
      .eq('period', `${days}d`)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot) {
      return NextResponse.json(
        { error: 'No financial data available yet. Run analysis first.' },
        { status: 404 }
      );
    }

    // ── Fetch last 7 chart points ───────────────────────────────────────
    const { data: historicalSnapshots } = await supabase
      .from('finance_snapshots')
      .select('snapshot_date, metrics')
      .eq('business_id', businessId)
      .eq('period', '30d')
      .order('snapshot_date', { ascending: true })
      .limit(7);

    const chartData = (historicalSnapshots ?? []).map((row: any) => {
      const date = new Date(row.snapshot_date);
      const month = date.toLocaleString('en-MY', { month: 'short', year: '2-digit' });
      const revenue = parseFloat(row.metrics?.summary?.total_revenue ?? '0');
      return { month, revenue };
    });

    // ── Derived values ──────────────────────────────────────────────────
    const summary = snapshot.metrics?.summary ?? {};
    const byProduct: any[] = snapshot.metrics?.by_product ?? [];
    const signals: any[] = snapshot.signals ?? [];
    const insights: string = snapshot.insights ?? '';
    const businessName = business?.name ?? 'Unknown Business';
    const marketplace = business?.marketplace ?? 'N/A';
    const reportDate = new Date().toLocaleString('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const revenue = parseFloat(summary.total_revenue ?? '0').toFixed(2);
    const costs   = parseFloat(summary.total_costs   ?? '0').toFixed(2);
    const profit  = parseFloat(summary.total_profit  ?? '0').toFixed(2);
    const margin  = parseFloat(summary.overall_margin_pct ?? '0').toFixed(1);
    const orders  = summary.total_orders ?? 0;

    // Max bar width for ASCII trend
    const maxRev = Math.max(...chartData.map(p => p.revenue), 1);
    const trendRows = chartData
      .map(p => {
        const bars = Math.round((p.revenue / maxRev) * 20);
        return `  ${p.month.padEnd(7)} ${'█'.repeat(bars)}${'░'.repeat(20 - bars)} RM ${p.revenue.toFixed(0)}`;
      })
      .join('\n');

    const productRows = byProduct
      .map(p =>
        `  ${p.title} | ${p.units_sold} units | RM ${parseFloat(p.revenue).toFixed(2)} revenue | RM ${parseFloat(p.profit).toFixed(2)} profit | ${parseFloat(p.margin_pct).toFixed(1)}% margin`
      )
      .join('\n');

    const signalRows = signals.length
      ? signals.map(s => `  [${s.action?.toUpperCase()}] ${s.product_name} — ${s.reason}`).join('\n')
      : '  No active signals.';

    // ── Single GLM call for all 3 narrative sections ──────────────────────────
    // Single call avoids rate-limit issues from parallel requests.
    const glm = getGlmClient();

    // Build smart code-based fallbacks from real data (used if GLM fails/times out)
    const topProduct = [...byProduct].sort((a: any, b: any) => parseFloat(b.margin_pct) - parseFloat(a.margin_pct))[0];
    const bottomProduct = [...byProduct].sort((a: any, b: any) => parseFloat(a.margin_pct) - parseFloat(b.margin_pct))[0];
    const repriceProducts = byProduct.filter((p: any) => parseFloat(p.margin_pct) < 30);
    const boostProducts = byProduct.filter((p: any) => parseFloat(p.margin_pct) >= 40);

    const fallbackObs = [
      topProduct ? `${topProduct.title} leads with a ${parseFloat(topProduct.margin_pct).toFixed(1)}% margin and ${topProduct.units_sold} units sold, making it the strongest performer in the portfolio.` : '',
      bottomProduct && parseFloat(bottomProduct.margin_pct) < 20 ? `${bottomProduct.title} is critically underperforming at ${parseFloat(bottomProduct.margin_pct).toFixed(1)}% margin — immediate repricing or retirement is recommended.` : '',
      repriceProducts.length > 0 ? `${repriceProducts.length} product(s) fall below the 30% margin threshold and require pricing review.` : 'All products are maintaining healthy margins above the 30% target.',
    ].filter(Boolean).join(' ');

    const fallbackRec = [
      boostProducts.length > 0 ? `1. Increase ad spend on ${boostProducts.map((p: any) => p.title).join(' and ')} — high margin makes them strong ROI candidates.` : '1. Identify top-margin products and allocate promotional budget accordingly.',
      repriceProducts.length > 0 ? `2. Raise prices on ${repriceProducts.map((p: any) => p.title).join(', ')} to bring margins above 30%.` : '2. Maintain current pricing strategy as all products are above margin targets.',
      `3. Run a small paid promotion (RM 20–50) on ${topProduct?.title ?? 'top products'} to validate demand before scaling ad spend.`,
      `4. Set a monthly snapshot review cadence to track margin trends and act on Finance Agent signals promptly.`,
    ].join('\n');

    let execSummary = insights || '';
    let keyObs = fallbackObs;
    let recommendations = fallbackRec;

    try {
      const glmRes = await glm.chat.completions.create({
        model: process.env.GLM_MODEL || 'ilmu-glm-5.1',
        messages: [
          {
            role: 'system',
            content: `You are a financial analyst writing a report for a print-on-demand business. Write exactly 3 sections, each separated by the exact string "|||".
Section 1 (2-3 sentences): Overall business health and key highlights.
Section 2 (2-3 sentences): Most important product-level findings — which perform well, which underperform, and why.
Section 3 (4 numbered items): Strategic action recommendations, one per line, format "1. action".
Output ONLY the 3 sections separated by "|||". No titles, no intro text, no markdown.`,
          },
          {
            role: 'user',
            content: `Business: ${businessName} | Revenue: RM ${revenue} | Costs: RM ${costs} | Profit: RM ${profit} | Margin: ${margin}% | Orders: ${orders}\nProducts: ${productRows}\nSignals: ${signalRows}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      });

      const raw = glmRes.choices[0]?.message?.content?.trim() ?? '';
      const parts = raw.split('|||').map((s: string) => s.trim()).filter(Boolean);

      if (parts[0] && parts[0].length > 20) execSummary = parts[0];
      if (parts[1] && parts[1].length > 20) keyObs = parts[1];
      if (parts[2] && parts[2].length > 20) recommendations = parts[2];
    } catch (glmErr: any) {
      console.warn('[Report] GLM call failed, using code-based fallbacks:', glmErr.message);
    }

    // ── Build HTML report (data tables rendered here, not by GLM) ───────
    const signalBadgeColor: Record<string, string> = {
      BOOST: '#D1FAE5',
      REPRICE: '#FEF3C7',
      RETIRE: '#FEE2E2',
    };
    const signalTextColor: Record<string, string> = {
      BOOST: '#2D7A4F',
      REPRICE: '#D97706',
      RETIRE: '#C0584A',
    };

    const productTableRows = byProduct
      .sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))
      .map(p => {
        const m = parseFloat(p.margin_pct);
        const marginColor = m >= 40 ? '#2D7A4F' : m >= 25 ? '#D97706' : '#C0584A';
        const sig = signals.find(s => s.product_id === p.product_id);
        const sigLabel = sig
          ? `<span style="background:${signalBadgeColor[sig.action?.toUpperCase()] ?? '#E5E7EB'};color:${signalTextColor[sig.action?.toUpperCase()] ?? '#374151'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${sig.action?.toUpperCase()}</span>`
          : '—';
        return `
          <tr style="border-bottom:1px solid #E8E7E2;">
            <td style="padding:10px 14px;font-weight:500;">${p.title}</td>
            <td style="padding:10px 14px;text-align:center;">${p.units_sold}</td>
            <td style="padding:10px 14px;text-align:right;">RM ${parseFloat(p.revenue).toFixed(2)}</td>
            <td style="padding:10px 14px;text-align:right;">RM ${parseFloat(p.cost ?? 0).toFixed(2)}</td>
            <td style="padding:10px 14px;text-align:right;font-weight:600;color:${parseFloat(p.profit) >= 0 ? '#2D7A4F' : '#C0584A'};">RM ${parseFloat(p.profit).toFixed(2)}</td>
            <td style="padding:10px 14px;text-align:center;font-weight:600;color:${marginColor};">${m.toFixed(1)}%</td>
            <td style="padding:10px 14px;text-align:center;">${sigLabel}</td>
          </tr>`;
      })
      .join('');

    const signalCards = signals.length
      ? signals.map(s => {
          const upper = s.action?.toUpperCase() ?? 'BOOST';
          return `
          <div style="background:#FFFFFF;border:1px solid #E8E7E2;border-left:4px solid ${signalTextColor[upper] ?? '#C9A84C'};border-radius:8px;padding:14px 18px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="background:${signalBadgeColor[upper] ?? '#FEF3C7'};color:${signalTextColor[upper] ?? '#D97706'};padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;">${upper}</span>
              <span style="font-weight:600;font-size:14px;">${s.product_name}</span>
              ${s.priority === 'HIGH' ? '<span style="font-size:11px;color:#C0584A;font-weight:600;">● HIGH PRIORITY</span>' : ''}
            </div>
            <p style="margin:0;color:#6B6A64;font-size:13px;">${s.reason}</p>
          </div>`;
        }).join('')
      : '<p style="color:#6B6A64;">No active signals at this time.</p>';

    const trendBars = chartData.map(p => {
      const barPct = Math.round((p.revenue / maxRev) * 100);
      const isCurrent = chartData[chartData.length - 1] === p;
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:10px;color:#6B6A64;">RM ${p.revenue.toFixed(0)}</span>
          <div style="width:100%;background:${isCurrent ? '#141412' : '#C9A84C'};opacity:${isCurrent ? 1 : 0.7};border-radius:4px 4px 0 0;height:${Math.max(barPct * 1.2, 4)}px;"></div>
          <span style="font-size:10px;${isCurrent ? 'font-weight:700;color:#141412;' : 'color:#6B6A64;'}">${p.month}</span>
        </div>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Finance Report — ${businessName}</title>
  <style>
    @page {
      margin: 48px 40px;  /* top/bottom left/right page margins for pages 2+ */
    }
    @page :first {
      margin: 0;  /* cover page has no margin — it handles its own padding */
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .avoid-break { page-break-inside: avoid; break-inside: avoid; }
      .page-break-before { page-break-before: always; break-before: always; }
      table { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
    }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#F7F6F2;color:#141412;">

  <!-- COVER -->
  <div style="background:#141412;color:#FAFAF8;padding:60px 48px 48px;min-height:200px;">
    <div style="font-size:11px;letter-spacing:0.12em;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">Podilot · Finance Agent</div>
    <h1 style="margin:0 0 8px;font-size:36px;font-family:Georgia,serif;font-weight:400;">${businessName}</h1>
    <h2 style="margin:0 0 24px;font-size:18px;font-weight:300;color:#FAFAF8cc;">Financial Performance Report</h2>
    <div style="display:flex;gap:32px;flex-wrap:wrap;">
      <div><div style="font-size:10px;color:#FAFAF8aa;text-transform:uppercase;letter-spacing:0.08em;">Report Date</div><div style="font-size:14px;margin-top:4px;">${reportDate}</div></div>
      <div><div style="font-size:10px;color:#FAFAF8aa;text-transform:uppercase;letter-spacing:0.08em;">Period</div><div style="font-size:14px;margin-top:4px;">Last ${days} days</div></div>
      <div><div style="font-size:10px;color:#FAFAF8aa;text-transform:uppercase;letter-spacing:0.08em;">Marketplace</div><div style="font-size:14px;margin-top:4px;">${marketplace}</div></div>
    </div>
  </div>

  <div style="padding:40px 48px;max-width:960px;margin:0 auto;">

    <!-- KPI CARDS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px;">
      ${[
        { label: 'Total Revenue', value: `RM ${revenue}`, color: '#2D7A4F' },
        { label: 'Printify Costs', value: `RM ${costs}`, color: '#C0584A' },
        { label: 'Net Profit', value: `RM ${profit}`, color: parseFloat(profit) >= 0 ? '#2D7A4F' : '#C0584A' },
        { label: 'Profit Margin', value: `${margin}%`, color: parseFloat(margin) >= 30 ? '#2D7A4F' : '#D97706' },
      ].map(k => `
        <div style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:20px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#6B6A64;margin-bottom:8px;">${k.label}</div>
          <div style="font-size:24px;font-family:Georgia,serif;color:${k.color};font-weight:400;">${k.value}</div>
        </div>`).join('')}
      <div style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#6B6A64;margin-bottom:8px;">Total Orders</div>
        <div style="font-size:24px;font-family:Georgia,serif;color:#141412;">${orders}</div>
      </div>
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div class="avoid-break" style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:28px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">Executive Summary</h3>
      <p style="margin:0;line-height:1.8;color:#141412;font-size:14px;">${execSummary.replace(/\n/g, '<br/>')}</p>
    </div>

    <!-- KEY OBSERVATIONS -->
    <div class="avoid-break" style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:28px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">Key Observations</h3>
      <p style="margin:0;line-height:1.8;color:#141412;font-size:14px;">${keyObs.replace(/\n/g, '<br/>')}</p>
    </div>

    <!-- REVENUE TREND -->
    ${chartData.length > 0 ? `
    <div class="avoid-break" style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:28px;margin-bottom:24px;">
      <h3 style="margin:0 0 20px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">Revenue Trend — Last ${chartData.length} Months</h3>
      <div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding-bottom:0;">
        ${trendBars}
      </div>
    </div>` : ''}

    <!-- PRODUCT PERFORMANCE -->
    <div class="avoid-break" style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:20px 20px 16px;border-bottom:1px solid #E8E7E2;">
        <h3 style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">Product Performance</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#F7F6F2;">
            ${['Product','Units','Revenue','Cost','Profit','Margin','Signal'].map(h =>
              `<th style="padding:10px 14px;text-align:${h === 'Product' ? 'left' : h === 'Signal' ? 'center' : 'right'};font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6B6A64;font-weight:600;">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${productTableRows}</tbody>
      </table>
    </div>

    <!-- AGENT SIGNALS -->
    <div class="avoid-break" style="margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">◈ Agent Signals</h3>
      ${signalCards}
    </div>

    <!-- STRATEGIC RECOMMENDATIONS -->
    <div class="avoid-break" style="background:#FFFFFF;border:1px solid #E8E7E2;border-radius:10px;padding:28px;margin-bottom:40px;">
      <h3 style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A84C;font-family:system-ui;">Strategic Recommendations</h3>
      <div style="line-height:1.8;color:#141412;font-size:14px;">${recommendations.replace(/\n/g, '<br/>')}</div>
    </div>

    <!-- FOOTER -->
    <div style="border-top:1px solid #E8E7E2;padding-top:20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#6B6A64;">Generated ${reportDate} · Podilot Finance Agent</span>
      <span style="font-size:11px;color:#C9A84C;font-weight:600;">CONFIDENTIAL</span>
    </div>

  </div>
</body>
</html>`;

    // ── Convert HTML → PDF via headless Chromium ───────────────────────
    const isLocal = process.env.NODE_ENV === 'development';
    
    let executablePath;
    if (isLocal) {
      executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else {
      executablePath = await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
      );
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath,
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        })
      );
    } finally {
      await browser.close();
    }

    const date = new Date().toISOString().split('T')[0];
    return new Response(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="finance-report-${businessId}-${date}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[API] Finance Report Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate report' }, { status: 500 });
  }
}
