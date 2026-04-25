"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Brain, Box, Rocket, LineChart, Send, AlertCircle, Clock, Check, RefreshCw } from "lucide-react";
import type { WorkflowRow } from "@/lib/types/workflow";

interface CommandCenterProps {
  businessId: string; // Could be a UUID or a slug (e.g. 'moki')
}

interface ChatMessage {
  role: "ai" | "user";
  text: string;
}

const AGENTS = [
  { id: "orchestrator",  name: "Orchestrator",   desc: "Central reasoning engine",  icon: Brain,     color: "text-purple-400" },
  { id: "design_agent",  name: "Design Agent",   desc: "Product design & pricing",  icon: Box,       color: "text-teal-500"   },
  { id: "launch_agent",  name: "Launch Agent",   desc: "Publish to marketplace",    icon: Rocket,    color: "text-rose-500"   },
  { id: "finance_agent", name: "Finance Agent",  desc: "Profit analysis",           icon: LineChart, color: "text-blue-500"   },
];

export default function CommandCenter({ businessId }: CommandCenterProps) {
  const supabase = createClient();
  const [realBusinessId, setRealBusinessId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "System online. Currently monitoring agent coordination for your store. How can I help you today?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Resolve Slug to UUID and fetch initial data
  const refreshData = useCallback(async (uuid?: string) => {
    const targetId = uuid || realBusinessId;
    if (!targetId) return;

    setIsRefreshing(true);
    const { data } = await supabase
      .from("workflows")
      .select("*")
      .eq("business_id", targetId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) setWorkflows(data as WorkflowRow[]);
    setIsRefreshing(false);
  }, [realBusinessId, supabase]);

  useEffect(() => {
    const init = async () => {
      // If businessId is not a UUID, resolve it
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
      let uuid = businessId;

      if (!isUuid) {
        const { data } = await supabase
          .from("businesses")
          .select("id")
          .or(`id.eq.${businessId},name.ilike.${businessId}`)
          .maybeSingle();
        if (data) uuid = data.id;
      }

      setRealBusinessId(uuid);
      refreshData(uuid);

      // Subscribe to real-time updates with a unique channel name to avoid race conditions
      const channel = supabase
        .channel(`workflows-${uuid}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "workflows", filter: `business_id=eq.${uuid}` },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setWorkflows((prev) => [payload.new as WorkflowRow, ...prev]);
            } else if (payload.eventType === "UPDATE") {
              setWorkflows((prev) =>
                prev.map((wf) => (wf.id === payload.new.id ? (payload.new as WorkflowRow) : wf))
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();
  }, [businessId, supabase, refreshData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMsg = chatInput;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`/api/business/${businessId}/chat/orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      
      if (data.error) {
        setMessages((prev) => [...prev, { role: "ai", text: `Error: ${data.error}` }]);
      } else if (data.reply) {
        setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", text: "Network error. Please check your connection." }]);
    } finally {
      setIsTyping(false);
      // Fallback: manually refresh after 1s in case Realtime is slow
      setTimeout(() => refreshData(), 1500);
    }
  };

  const TWO_MINUTES_AGO = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const activeWorkflows = workflows.filter((w) => {
    if (w.state !== "pending" && w.state !== "processing") return false;
    // agent_active rows are ephemeral — discard if older than 2 min (stuck/failed cleanup)
    if (w.type === "agent_active" && w.created_at < TWO_MINUTES_AGO) return false;
    return true;
  });
  const recentWorkflows = workflows.filter(
    (w) => (w.state === "processed" || w.state === "failed") && w.type !== "agent_active",
  );
  const currentActive = activeWorkflows[0];

  const getAgentStatus = (agentId: string) => {
    if (agentId === "orchestrator") return "Running";
    const active = activeWorkflows.find((w) => w.target_agent === agentId);
    if (!active) return "Idle";
    return active.state === "processing" ? "Running" : "Waiting";
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto h-[800px]">
      {/* LEFT PANEL: DAG & Logs */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-xl p-8 flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="flex justify-between items-start mb-8">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
              Active Workflow {currentActive ? `· ${currentActive.type.replace(/_/g, " ")}` : "· None"}
            </div>
            <button 
              onClick={() => refreshData()} 
              disabled={isRefreshing}
              className="p-1 hover:bg-neutral-200 rounded-md transition-colors"
              title="Refresh status"
            >
              <RefreshCw size={14} className={`text-neutral-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-6 relative z-10 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden">
            {AGENTS.map((agent, i) => {
              const status = getAgentStatus(agent.id);
              const isActive = status === "Running" || status === "Waiting";
              const Icon = agent.icon;

              return (
                <div key={agent.id} className="flex flex-col items-center">
                  <div className={`w-80 rounded-xl p-4 border transition-all duration-300 ${
                    agent.id === "orchestrator"
                      ? "bg-[#141412] border-[#2A2A27] text-white shadow-lg"
                      : isActive
                        ? "bg-white border-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.15)] scale-[1.02]"
                        : "bg-white/60 border-[#E8E7E2] opacity-70"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className={`mt-1 ${agent.color}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className={`font-semibold ${agent.id === "orchestrator" ? "text-white" : "text-[#141412]"}`}>
                            {agent.name}
                          </div>
                          <div className={`text-xs mt-0.5 ${agent.id === "orchestrator" ? "text-neutral-400" : "text-neutral-500"}`}>
                            {agent.desc}
                          </div>
                        </div>
                      </div>
                      
                      {status !== "Idle" && (
                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          status === "Running" ? "bg-amber-100 text-amber-700" :
                          "bg-neutral-100 text-neutral-600"
                        }`}>
                          {status}
                        </div>
                      )}
                    </div>
                    
                    {agent.id === "orchestrator" && currentActive && (
                      <div className="mt-3 flex gap-2">
                        <div className="text-[10px] bg-[#2A2A27] px-2 py-1 rounded text-neutral-300">
                          Intent: {currentActive.type}
                        </div>
                        <div className="text-[10px] bg-[#2A2A27] px-2 py-1 rounded text-neutral-300">
                          {currentActive.state}
                        </div>
                      </div>
                    )}

                    {status === "Running" && agent.id !== "orchestrator" && (
                      <div className="mt-3">
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#C9A84C] h-full w-2/3 animate-pulse rounded-full" />
                        </div>
                        <div className="text-[10px] text-amber-600 mt-2 font-medium">
                          Agent executing logic...
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {i < AGENTS.length - 1 && (
                    <div className={`w-0.5 h-6 transition-colors duration-300 ${isActive ? "bg-[#C9A84C]" : "bg-[#E8E7E2]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT WORKFLOWS */}
        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-xl p-6 overflow-hidden flex flex-col h-[280px]">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">
            Recent Activity Log
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto pr-2">
            {recentWorkflows.length > 0 ? recentWorkflows.slice(0, 8).map((wf) => (
              <div key={wf.id} className="flex items-center justify-between bg-white border border-[#E8E7E2] p-3 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  {wf.state === "processed" ? (
                    <Check className="text-green-500" size={16} />
                  ) : wf.state === "failed" ? (
                    <AlertCircle className="text-red-500" size={16} />
                  ) : (
                    <Clock className="text-amber-500" size={16} />
                  )}
                  <span className="text-sm font-medium text-[#141412] truncate max-w-[200px]">
                    {wf.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-500 uppercase">
                    {wf.target_agent?.replace('_agent', '') || 'system'}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono">
                  {new Date(wf.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            )) : (
              <div className="text-sm text-neutral-500 text-center py-8">No historical workflows found for this business.</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Chat Interface */}
      <div className="w-full lg:w-[400px] bg-white border border-[#E8E7E2] rounded-xl flex flex-col shadow-sm">
        <div className="p-4 border-b border-[#E8E7E2] flex items-center justify-between">
          <div className="font-semibold text-[#141412] flex items-center gap-2">
            <Brain size={18} className="text-neutral-500" />
            Command Interface
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${realBusinessId ? 'bg-green-500' : 'bg-neutral-300 animate-pulse'}`} />
            <span className="text-xs text-neutral-500 font-medium">{realBusinessId ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#FAFAF8] [&::-webkit-scrollbar]:hidden">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                msg.role === "ai" ? "bg-[#141412] text-white shadow-sm" : "bg-[#C9A84C] text-white shadow-sm"
              }`}>
                {msg.role === "ai" ? "AI" : "ME"}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[85%] shadow-sm ${
                msg.role === "ai" 
                  ? "bg-white border border-[#E8E7E2] text-[#141412] rounded-tl-sm" 
                  : "bg-[#141412] text-white rounded-tr-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#141412] text-white flex items-center justify-center text-[10px] font-bold shrink-0">AI</div>
              <div className="bg-white border border-[#E8E7E2] rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center shadow-sm">
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {currentActive && (
          <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {currentActive.target_agent?.replace("_", " ")}: {currentActive.state}...
          </div>
        )}

        <div className="p-4 border-t border-[#E8E7E2] bg-white rounded-b-xl">
          <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E8E7E2] rounded-lg p-2 focus-within:border-[#C9A84C] transition-all shadow-inner">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={realBusinessId ? "Ask the orchestrator..." : "Connecting to store..."}
              disabled={!realBusinessId}
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#141412] px-2 placeholder:text-neutral-400 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !realBusinessId}
              className="p-2 bg-[#141412] hover:bg-neutral-800 disabled:opacity-50 text-white rounded-md transition-all shadow-md active:scale-95"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
