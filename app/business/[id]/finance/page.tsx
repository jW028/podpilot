'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useFinanceAgent } from './useFinanceAgent';

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
      </aside>

      {/* -- MAIN CONTENT -- */}
      <div className='flex-1 flex flex-col min-w-0 h-screen overflow-y-auto'>
        {/* TOPBAR */}
        <div className='p-[16px_28px] flex items-center justify-between border-b border-[#E8E7E2] bg-[#FAFAF8] sticky top-0 z-10'>
          <div>
            <div className='font-serif text-[20px]'>Finance</div>
            <div className='text-[12px] text-[#6B6A64] mt-[1px]'>AI-powered profit analysis · MokiPrints</div>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className='p-[24px_28px] max-w-6xl'>
          {!hasInitialData && loading && (
             <div className='h-[400px] flex flex-col items-center justify-center text-[14px] text-[#6B6A64]'>
               <div className='w-[24px] h-[24px] border-[2px] border-[#C9A84C] border-t-transparent rounded-[50%] animate-spin mb-[12px]'></div>
               Analyzing MokiPrints financial data...
             </div>
          )}

          {hasInitialData && (
            <>
              <div className='grid grid-cols-4 gap-[12px] mb-[20px]'>
                <MetricCard label='REVENUE (APR)' value={`RM ${summary?.total_revenue || '4,280'}`} delta='↑ 23% vs March' />
                <MetricCard label='PRINTIFY COSTS' value={`RM ${summary?.total_costs || '1,820'}`} delta='↑ 12% vs March' highlight={true} />
                <MetricCard label='NET PROFIT' value={`RM ${summary?.total_profit || '2,460'}`} delta='↑ 31% vs March' />
                <MetricCard label='MARGIN' value={`${summary?.overall_margin_pct || '57.5'}%`} delta='↑ 4.2pts' />
              </div>

              <div className='grid grid-cols-2 gap-[16px]'>
                <div className='bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-[20px] h-[340px] flex flex-col'>
                  <div className='font-serif text-[16px] text-[#141412] mb-[12px]'>Monthly Revenue</div>
                  <div className='flex items-end gap-[4px] flex-1 mt-[20px]'>
                    {[45, 55, 48, 62, 58, 70, 82].map((h, i) => (
                      <div key={i} className={`flex-1 rounded-[4px_4px_0_0] ${i === 6 ? 'bg-gradient-to-t from-[#141412] to-[#2A2A27]' : 'bg-gradient-to-t from-[#9E7A2E] to-[#C9A84C] opacity-60'} transition-opacity`} style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                  <div className='flex gap-[4px] mt-[12px]'>
                    {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => (
                       <div key={m} className={`flex-1 text-center text-[10px] ${i === 6 ? 'font-semibold text-[#141412]' : 'text-[#6B6A64]'}`}>{m}</div>
                    ))}
                  </div>
                </div>

                <div className='bg-[#2A2A27] text-[#FAFAF8] rounded-[12px] p-[20px] flex flex-col h-[340px]'>
                  <div className='flex items-center gap-[10px] pb-[16px] shrink-0'>
                    <span className='text-[18px] opacity-70'>◈</span>
                    <div>
                      <div className='text-[13px] font-semibold'>Finance Agent</div>
                    </div>
                  </div>
                  
                  <div className='flex-1 overflow-y-auto pr-[4px] flex flex-col gap-[12px] pb-[10px]'>
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-[10px] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`p-[12px_16px] text-[13px] leading-relaxed max-w-[85%] whitespace-pre-line ${msg.role === 'ai' ? 'bg-[#FAFAF8] text-[#141412] rounded-[2px_10px_10px_10px]' : 'bg-[#141412] border border-[#141412] rounded-[10px_2px_10px_10px]'}`}>
                           {msg.text}
                        </div>
                      </div>
                    ))}
                    {loading && <div className='p-[12px_16px] bg-[#FAFAF8] text-black w-[50px] rounded-[2px_10px_10px_10px]'>...</div>}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className='mt-auto pt-[16px] shrink-0 border-t border-[#FAFAF8]/10'>
                    <div className='flex items-center gap-[8px] p-[6px_10px] bg-[#141412] rounded-[8px]'>
                      <input 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder='Ask Finance Agent...'
                        className='flex-1 bg-transparent border-none outline-none text-[#FAFAF8] text-[13px]'
                      />
                      <button onClick={handleSend} disabled={loading} className='w-[28px] h-[28px] bg-[#FAFAF8]/10 hover:bg-[#C9A84C] disabled:cursor-not-allowed rounded-[6px]'>↑</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
