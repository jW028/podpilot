'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useFinanceAgent } from '@/hooks/useFinanceAgent';

function MetricCard({ label, value, sub, highlight, delta }: any) {
  return (
    <div className='bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[16px_18px]'>
      <div className='text-[11px] text-[#6B6A64] uppercase tracking-[0.06em] mb-[6px]'>{label}</div>
      <div className='font-serif text-[26px] text-[#141412] leading-[1.1]'>{value}</div>
      <div className={`text-[11px] mt-[4px] ${highlight ? 'text-[#C0584A]' : 'text-[#4A8C5C]'}`}>{delta}</div>
      {sub && <div className='hidden'>{sub}</div>}
    </div>
  );
}

export default function FinancePage() {
  const params = useParams();
  const businessId = params.id as string;
  const { data, loading, error, runAnalysis } = useFinanceAgent(businessId);
  const [days, setDays] = useState(30);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [hasInitialData, setHasInitialData] = useState(false);

  useEffect(() => {
    if (businessId) runAnalysis({ days });
  }, [businessId]); 

  useEffect(() => {
    if (data?.insights) {
      setMessages(prev => [...prev, { role: 'ai', text: data.insights }]);
      setHasInitialData(true);
    }
  }, [data]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const summary = data?.metrics?.summary;
  const products = data?.metrics?.by_product || [];
  const signals = data?.signals || [];

  const handleSend = () => {
    if (!chatInput.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    runAnalysis({ days, userMessage: chatInput });
    setChatInput('');
  };

  return (
    <div className='flex bg-[#F7F6F2] font-sans text-[14px] min-h-screen text-[#141412] overflow-hidden'>
      {/* -- SIDEBAR -- */}
      <aside className='w-[240px] bg-[#FAFAF8] border-r border-[#E8E7E2] flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto'>
        <div className='p-[20px_20px_16px] border-b border-[#E8E7E2]'>
          <div className='font-serif text-[20px] text-[#141412] tracking-[-0.3px]'>Pod<span className='text-[#C9A84C]'>ilot</span></div>
        </div>
        <div className='m-[12px] p-[10px_12px] bg-[#F4F3EF] rounded-[8px] border border-[#E8E7E2] flex items-center justify-between cursor-pointer'>
          <div className='flex items-center gap-[8px]'>
            <div className='w-[28px] h-[28px] rounded-[6px] bg-gradient-to-br from-[#E8D08A] to-[#C9A84C] flex items-center justify-center text-[11px] font-semibold text-[#FAFAF8]'>MK</div>
            <div>
              <div className='text-[12px] font-medium text-[#141412]'>MokiPrints</div>
              <div className='text-[10px] text-[#6B6A64]'>April 2026</div>
            </div>
          </div>
          <div className='text-[10px] text-[#C4C3BC]'>▼</div>
        </div>
        <div className='p-[8px_12px_4px]'>
          <div className='text-[10px] font-semibold tracking-[0.08em] uppercase text-[#C4C3BC] px-[8px] mb-[4px]'>Business</div>
          {['Overview', 'AI Command Center', 'Products', 'Launch & Integrations'].map(item => (
            <div key={item} className='flex items-center gap-[10px] p-[8px_10px] rounded-[8px] text-[#6B6A64] text-[13px] cursor-pointer hover:bg-[#F4F3EF] hover:text-[#141412] mb-[1px]'>
              <span className='opacity-60 text-[14px] w-[16px] text-center'>◇</span> {item}
            </div>
          ))}
          <div className='flex items-center justify-between p-[8px_10px] rounded-[8px] text-[#6B6A64] text-[13px] cursor-pointer hover:bg-[#F4F3EF] hover:text-[#141412] mb-[1px]'>
            <div className='flex items-center gap-[10px]'><span className='opacity-60 text-[14px] w-[16px] text-center'>◎</span> Customer Support</div>
            <span className='bg-[#C9A84C] text-[#FAFAF8] text-[9px] font-semibold px-[6px] py-[2px] rounded-[10px]'>8</span>
          </div>
          <div className='flex items-center justify-between p-[8px_10px] rounded-[8px] bg-[#141412] text-[#FAFAF8] text-[13px] cursor-pointer mb-[1px]'>
            <div className='flex items-center gap-[10px]'><span className='opacity-100 text-[14px] w-[16px] text-center'>◈</span> Finance</div>
            <span className='text-[9px] text-[#9E7A2E] font-medium'>AI</span>
          </div>
          <div className='flex items-center gap-[10px] p-[8px_10px] rounded-[8px] text-[#6B6A64] text-[13px] cursor-pointer hover:bg-[#F4F3EF] hover:text-[#141412] mb-[1px]'>
            <span className='opacity-60 text-[14px] w-[16px] text-center'>⚙️</span> Settings
          </div>
        </div>
        <div className='mt-auto p-[12px] border-t border-[#E8E7E2]'>
          <div className='flex items-center gap-[8px] p-[8px_10px] rounded-[8px] cursor-pointer hover:bg-[#F4F3EF]'>
            <div className='w-[28px] h-[28px] rounded-[50%] bg-[#2A2A27] flex items-center justify-center text-[11px] text-[#FAFAF8] font-medium'>AH</div>
            <div>
              <div className='text-[12px] font-medium'>Ahmad Haziq</div>
              <div className='text-[10px] text-[#6B6A64]'>ahmad@example.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* -- MAIN CONTENT -- */}
      <div className='flex-1 flex flex-col min-w-0 h-screen overflow-y-auto'>
        {/* TOPBAR */}
        <div className='p-[16px_28px] flex items-center justify-between border-b border-[#E8E7E2] bg-[#FAFAF8] sticky top-0 z-10'>
          <div>
            <div className='font-serif text-[20px]'>Finance</div>
            <div className='text-[12px] text-[#6B6A64] mt-[1px]'>AI-powered profit analysis · MokiPrints</div>
          </div>
          <div className='flex items-center gap-[8px]'>
            <button className='px-[16px] py-[8px] rounded-[8px] border border-[#E8E7E2] bg-transparent text-[#6B6A64] hover:bg-[#F4F3EF] hover:text-[#141412] text-[13px] font-medium transition cursor-pointer'>
              Export CSV
            </button>
            <button className='px-[16px] py-[8px] rounded-[8px] border-none bg-[#C9A84C] hover:bg-[#9E7A2E] text-[#FAFAF8] text-[13px] font-medium transition cursor-pointer flex items-center gap-[6px]'>
              ✦ Generate Report
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className='p-[24px_28px] max-w-6xl'>
          {error && (
            <div className='bg-[#C0584A]/10 border border-[#C0584A]/20 text-[#C0584A] rounded-[12px] px-[20px] py-[16px] text-[14px] font-medium mb-[20px]'>
              {error}
            </div>
          )}

          {!hasInitialData && loading && (
             <div className='h-[400px] flex flex-col items-center justify-center text-[14px] text-[#6B6A64]'>
               <div className='w-[24px] h-[24px] border-[2px] border-[#C9A84C] border-t-transparent rounded-[50%] animate-spin mb-[12px]'></div>
               Analyzing MokiPrints financial data...
             </div>
          )}

          {hasInitialData && (
            <>
              <div className='grid grid-cols-4 gap-[12px] mb-[20px]'>
                <MetricCard label='REVENUE (APR)' value={summary?.total_revenue ? `RM ${summary.total_revenue}` : '—'} delta='↑ 23% vs March' />
                <MetricCard label='PRINTIFY COSTS' value={summary?.total_costs ? `RM ${summary.total_costs}` : '—'} delta='↑ 12% vs March' highlight={true} />
                <MetricCard label='NET PROFIT' value={summary?.total_profit ? `RM ${summary.total_profit}` : '—'} delta='↑ 31% vs March' />
                <MetricCard label='MARGIN' value={summary?.overall_margin_pct ? `${summary.overall_margin_pct}%` : '—'} delta='↑ 4.2pts' />
              </div>

              <div className='grid grid-cols-1 lg:grid-cols-2 gap-[16px]'>
                
                {/* LEFT COLUMN: CHART & SIGNALS */}
                <div className='flex flex-col gap-[16px]'>
                  {/* CHART CARD */}
                  <div className='bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] h-[190px] flex flex-col'>
                    <div className='font-serif text-[16px] text-[#141412] mb-[12px]'>Monthly Revenue</div>
                    <div className='flex items-end gap-[4px] flex-1 mt-[10px]'>
                      {[45, 55, 48, 62, 58, 70, parseFloat(summary?.overall_margin_pct) || 82].map((h, i) => (
                        <div key={i} className={`flex-1 rounded-[4px_4px_0_0] ${i === 6 ? 'bg-gradient-to-t from-[#141412] to-[#2A2A27]' : 'bg-gradient-to-t from-[#9E7A2E] to-[#C9A84C] opacity-60'} transition-opacity delay-75`} style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                    <div className='flex gap-[4px] mt-[12px]'>
                      {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => (
                         <div key={m} className={`flex-1 text-center text-[10px] ${i === 6 ? 'font-semibold text-[#141412]' : 'text-[#6B6A64]'}`}>{m}</div>
                      ))}
                    </div>
                  </div>

                  {/* SIGNALS CARD */}
                  <div className='bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] flex-1 min-h-[160px] overflow-hidden flex flex-col'>
                    <div className='font-serif text-[16px] text-[#141412] mb-[12px] flex items-center justify-between'>
                      ◈ Agent Signals
                      <div className='text-[10px] text-[#6B6A64] font-sans font-normal border border-[#E8E7E2] rounded-full px-[8px] py-[2px] bg-[#F4F3EF]'>Auto-updated</div>
                    </div>
                    <div className='flex flex-col gap-[12px] overflow-y-auto flex-1 pr-2 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#E8E7E2] [&::-webkit-scrollbar-thumb]:rounded-full'>
                      {signals.length > 0 ? signals.map((sig: any, idx: number) => (
                        <div key={idx} className='flex gap-[12px] items-start p-[10px] bg-[#F4F3EF] rounded-[8px]'>
                          <div className='text-[16px] leading-none mt-[2px] w-[20px] text-center'>
                            {sig.action === 'REPRICE' ? '🟡' : sig.action === 'RETIRE' ? '🔴' : '🟢'}
                          </div>
                          <div>
                            <div className='text-[12px] font-semibold text-[#141412]'>
                              {sig.action} <span className='font-medium text-[#6B6A64] ml-[4px] mx-[4px]'>•</span> <span className='font-medium text-[#141412]'>{sig.product_name || 'Product'}</span>
                            </div>
                            <div className='text-[11px] text-[#6B6A64] mt-[4px] leading-snug'>{sig.reason || 'Margin threshold triggered based on recent sales.'}</div>
                          </div>
                        </div>
                      )) : (
                        <div className='text-[12px] text-[#6B6A64] flex items-center justify-center flex-1 h-full'>No active signals at the moment.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: AI COMMAND / FINANCE AGENT CHAT CARD */}
                <div className='bg-[#2A2A27] text-[#FAFAF8] rounded-[12px] p-[20px] flex flex-col h-[366px] shadow-[0_4px_20px_rgba(20,20,18,0.15)]'>
                  <div className='flex items-center gap-[10px] pb-[16px] shrink-0'>
                    <span className='text-[#FAFAF8] text-[18px] opacity-70'>◈</span>
                    <div>
                      <div className='text-[13px] font-semibold mt-[-2px]'>Finance Agent</div>
                      <div className='text-[10px] text-[#FAFAF8]/50 mt-[1px]'>April 2026 insights & dialogue</div>
                    </div>
                  </div>
                  
                  <div className='flex-1 overflow-y-auto pr-[4px] flex flex-col gap-[12px] pb-[10px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#FAFAF8]/20 [&::-webkit-scrollbar-thumb]:rounded-full'>
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-[10px] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.role === 'ai' ? (
                          <div className='w-[24px] h-[24px] rounded-[50%] bg-[#141412] flex items-center justify-center text-[9px] shrink-0 font-semibold'>FA</div>
                        ) : (
                          <div className='w-[24px] h-[24px] rounded-[50%] bg-[#C9A84C] flex items-center justify-center text-[9px] shrink-0 font-semibold text-[#FAFAF8]'>AH</div>
                        )}
                        <div className={`p-[12px_16px] text-[13px] leading-relaxed max-w-[85%] whitespace-pre-line ${msg.role === 'ai' ? 'bg-[#FAFAF8] text-[#141412] rounded-[2px_10px_10px_10px]' : 'bg-[#141412] text-[#FAFAF8] border border-[#141412] rounded-[10px_2px_10px_10px]'}`}>
                           {msg.text}
                           {msg.role === 'ai' && i === 0 && (
                              <div className='flex gap-[8px] mt-[12px] pt-[12px] border-t border-[#E8E7E2]'>
                                <button className='bg-[#C9A84C] text-[#FAFAF8] border-none px-[12px] py-[6px] rounded-[6px] text-[11px] font-medium cursor-pointer hover:bg-[#9E7A2E]'>Apply suggestions</button>
                                <button className='bg-transparent border border-[#E8E7E2] text-[#141412] px-[12px] py-[6px] rounded-[6px] text-[11px] font-medium hover:bg-[#F4F3EF] cursor-pointer transition'>Full report</button>
                              </div>
                           )}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className='flex gap-[10px]'>
                        <div className='w-[24px] h-[24px] rounded-[50%] bg-[#141412] flex items-center justify-center text-[9px] shrink-0 font-semibold'>FA</div>
                        <div className='p-[12px_16px] bg-[#FAFAF8] rounded-[2px_10px_10px_10px] flex items-center gap-[4px] h-[40px]'>
                           <div className='w-[4px] h-[4px] bg-[#2A2A27] rounded-[50%] animate-bounce'></div>
                           <div className='w-[4px] h-[4px] bg-[#2A2A27] rounded-[50%] animate-bounce' style={{ animationDelay: '150ms' }}></div>
                           <div className='w-[4px] h-[4px] bg-[#2A2A27] rounded-[50%] animate-bounce' style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className='mt-auto pt-[16px] shrink-0 border-t border-[#FAFAF8]/10'>
                    <div className='flex items-center gap-[8px] p-[6px_10px] bg-[#141412] border border-[#FAFAF8]/20 focus-within:border-[#C9A84C] rounded-[8px] transition'>
                      <input 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder='Ask Finance Agent...'
                        className='flex-1 bg-transparent border-none outline-none text-[#FAFAF8] text-[13px] placeholder:text-[#FAFAF8]/30 px-[4px]'
                      />
                      <button onClick={handleSend} disabled={loading} className='w-[28px] h-[28px] bg-[#FAFAF8]/10 hover:bg-[#C9A84C] disabled:bg-[#FAFAF8]/5 disabled:cursor-not-allowed rounded-[6px] border-none flex items-center justify-center cursor-pointer transition'>
                        <span className='text-[16px] leading-none mb-[2px] text-[#FAFAF8]'>↑</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT ORDERS TABLE */}
              <div className='bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] mt-[16px] overflow-hidden flex-1 flex flex-col'>
                <div className='font-serif text-[16px] text-[#141412] px-[20px] py-[18px] border-b border-[#E8E7E2]'>Recent Orders</div>
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead>
                      <tr>
                        {['Order', 'Product', 'Platform', 'Revenue', 'Cost', 'Profit', 'Date'].map(h => (
                          <th key={h} className='text-left px-[20px] py-[12px] text-[10px] font-semibold text-[#6B6A64] uppercase tracking-[0.06em] border-b border-[#E8E7E2]'>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? products.map((p: any) => (
                         <tr key={p.product_id} className='hover:bg-[#F4F3EF] group border-b border-[#E8E7E2] last:border-b-0'>
                           <td className='px-[20px] py-[12px] text-[13px]'>#{p.product_id?.slice(-4) || '1052'}</td>
                           <td className='px-[20px] py-[12px] text-[13px] font-medium text-[#141412] truncate max-w-[180px]'>{p.title}</td>
                           <td className='px-[20px] py-[12px] text-[13px] text-[#6B6A64]'>Shopee</td>
                           <td className='px-[20px] py-[12px] text-[13px]'>RM {p.revenue.toFixed(2)}</td>
                           <td className='px-[20px] py-[12px] text-[13px] text-[#6B6A64]'>RM {p.cost.toFixed(2)}</td>
                           <td className={`px-[20px] py-[12px] text-[13px] font-semibold ${p.profit < 0 ? 'text-[#C0584A]' : 'text-[#2D7A4F]'}`}>RM {p.profit.toFixed(2)}</td>
                           <td className='px-[20px] py-[12px] text-[13px] text-[#6B6A64]'>22 Apr</td>
                         </tr>
                      )) : (
                         <tr className='border-b border-[#E8E7E2] last:border-none'>
                           <td className='px-[20px] py-[12px] text-[13px]'>#1052</td>
                           <td className='px-[20px] py-[12px] font-medium text-[#141412] text-[13px]'>Sunset Tote Bag</td>
                           <td className='px-[20px] py-[12px] text-[#6B6A64] text-[13px]'>Shopee</td>
                           <td className='px-[20px] py-[12px] text-[13px]'>RM 49</td>
                           <td className='px-[20px] py-[12px] text-[#6B6A64] text-[13px]'>RM 21</td>
                           <td className='px-[20px] py-[12px] text-[#2D7A4F] font-semibold text-[13px]'>RM 28</td>
                           <td className='px-[20px] py-[12px] text-[#6B6A64] text-[13px]'>22 Apr</td>
                         </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
