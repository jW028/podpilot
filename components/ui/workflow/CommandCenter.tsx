"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Brain, Box, Rocket, LineChart, Briefcase, Send,
  AlertCircle, Clock, Check, RefreshCw, ExternalLink, Lock,
} from "lucide-react";
import type { WorkflowRow } from "@/lib/types/workflow";
import type { AgentState } from "@/lib/types/agent";
import MarkdownText from "@/components/ui/shared/MarkdownText";

interface CommandCenterProps {
  businessId: string;
}

interface ChatMessage {
  role: "ai" | "user";
  text: string;
}

const AGENTS = [
  { id: "orchestrator",   name: "Orchestrator",    desc: "Central reasoning engine", icon: Brain,     color: "text-purple-400" },
  { id: "business_agent", name: "Business Agent",  desc: "Brand & niche strategy",   icon: Briefcase, color: "text-violet-500" },
  { id: "design_agent",   name: "Design Agent",    desc: "Product design & pricing", icon: Box,       color: "text-teal-500"   },
  { id: "launch_agent",   name: "Launch Agent",    desc: "Publish to marketplace",   icon: Rocket,    color: "text-rose-500"   },
  { id: "finance_agent",  name: "Finance Agent",   desc: "Profit analysis",          icon: LineChart, color: "text-blue-500"   },
];

const AGENT_ROUTES: Record<string, string> = {
  business_agent: "onboarding",
  design_agent:   "products",
  launch_agent:   "products",
  finance_agent:  "finance",
};

const WELCOME_MSG = "System online. Currently monitoring agent coordination for your store. How can I help you today?";
const SETUP_REQUIRED_MSG = "Your business setup is not complete yet. Please complete the onboarding process first before I can activate any agents for you.";

export default function CommandCenter({ businessId }: CommandCenterProps) {
  const supabase = createClient();
  const router = useRouter();
  const [realBusinessId, setRealBusinessId] = useState<string | null>(null);
  const [businessReady, setBusinessReady] = useState<boolean | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [agentStates, setAgentStates] = useState<AgentState[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshData = useCallback(async (uuid?: string) => {
    const targetId = uuid || realBusinessId;
    if (!targetId) return;

    setIsRefreshing(true);
    const [{ data: wfData }, { data: statesData }] = await Promise.all([
      supabase
        .from("workflows")
        .select("*")
        .eq("business_id", targetId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("agent_states")
        .select("*")
        .eq("business_id", targetId),
    ]);

    if (wfData) setWorkflows(wfData as WorkflowRow[]);
    if (statesData) setAgentStates(statesData as AgentState[]);
    setIsRefreshing(false);
  }, [realBusinessId, supabase]);

  useEffect(() => {
    const init = async () => {
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

      // Check whether onboarding is complete (brand_profiles record exists)
      const { data: brandProfile } = await supabase
        .from("brand_profiles")
        .select("business_id")
        .eq("business_id", uuid)
        .maybeSingle();

      const ready = !!brandProfile;
      setBusinessReady(ready);

      // If ready, lazily seed any missing agent_states rows
      if (ready) {
        fetch(`/api/business/${uuid}/agent-states/init`, { method: "POST" }).catch(() => {});
      }

      refreshData(uuid);

      // Restore chat history from localStorage
      try {
        const saved = localStorage.getItem(`oc-chat-${uuid}`);
        if (saved) {
          const parsed = JSON.parse(saved) as ChatMessage[];
          if (parsed.length > 0) {
            setMessages(parsed);
            setHistoryLoaded(true);
            return;
          }
        }
      } catch {}

      setMessages([{ role: "ai", text: ready ? WELCOME_MSG : SETUP_REQUIRED_MSG }]);
      setHistoryLoaded(true);

      const channelSuffix = `${uuid}-${Math.random().toString(36).slice(2)}`;

      const workflowsChannel = supabase
        .channel(`workflows-${channelSuffix}`)
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

      const agentStatesChannel = supabase
        .channel(`agent-states-${channelSuffix}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agent_states", filter: `business_id=eq.${uuid}` },
          (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const incoming = payload.new as AgentState;
              setAgentStates((prev) => {
                const exists = prev.some((s) => s.agent_name === incoming.agent_name);
                return exists
                  ? prev.map((s) => (s.agent_name === incoming.agent_name ? incoming : s))
                  : [...prev, incoming];
              });
            }
          }
        )
        .subscribe();

      // Real-time: unlock the UI the moment onboarding completes in another tab
      const brandProfileChannel = supabase
        .channel(`brand-profile-${channelSuffix}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "brand_profiles", filter: `business_id=eq.${uuid}` },
          () => {
            setBusinessReady(true);
            fetch(`/api/business/${uuid}/agent-states/init`, { method: "POST" }).catch(() => {});
            setMessages((prev) => [
              ...prev,
              { role: "ai", text: "Business setup complete! All agents are now active. How can I help you today?" },
            ]);
            refreshData(uuid);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(workflowsChannel);
        supabase.removeChannel(agentStatesChannel);
        supabase.removeChannel(brandProfileChannel);
      };
    };

    init();
  }, [businessId, supabase, refreshData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!realBusinessId || !historyLoaded) return;
    try {
      localStorage.setItem(`oc-chat-${realBusinessId}`, JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages, realBusinessId, historyLoaded]);

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
        if (typeof data.businessReady === "boolean") setBusinessReady(data.businessReady);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Network error. Please check your connection." }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => refreshData(), 1500);
    }
  };

  const [TWO_MINUTES_AGO] = useState(() => new Date(Date.now() - 2 * 60 * 1000).toISOString());
  const activeWorkflows = workflows.filter((w) => {
    if (w.state !== "pending" && w.state !== "processing" && w.state !== "awaiting_approval") return false;
    if (w.type === "agent_active" && w.created_at < TWO_MINUTES_AGO) return false;
    return true;
  });
  const recentWorkflows = workflows.filter(
    (w) => (w.state === "processed" || w.state === "failed") && w.type !== "agent_active",
  );
  const awaitingApproval = workflows.filter((w) => w.state === "awaiting_approval");
  const currentActives = activeWorkflows.filter((w) => w.state === "processing" || w.state === "pending");
  const primaryActive = currentActives[0];
  const runningAgentCount = agentStates.filter((s) => s.state === "running").length;

  const handleApprove = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/business/${businessId}/workflows/${workflowId}/approve`, {
        method: "PATCH",
      });
      if (res.ok) {
        refreshData();
      } else {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "ai", text: `Approval failed: ${data.error}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Failed to approve workflow." }]);
    }
  };

  type AgentDisplayStatus = "Running" | "Waiting" | "Idle" | "Error" | "Setup Required" | "Locked";

  const getAgentStatus = (agentId: string): AgentDisplayStatus => {
    if (agentId === "orchestrator") return "Running";

    // Phase 1: business setup not complete
    if (businessReady === false) {
      return agentId === "business_agent" ? "Setup Required" : "Locked";
    }

    const agentState = agentStates.find((s) => s.agent_name === agentId);
    if (agentState) {
      if (agentState.state === "running") return "Running";
      if (agentState.state === "waiting") return "Waiting";
      if (agentState.state === "error") return "Error";
      return "Idle";
    }
    // Fallback: infer from active workflows
    const active = activeWorkflows.find((w) => w.target_agent === agentId);
    if (!active) return "Idle";
    return active.state === "processing" ? "Running" : "Waiting";
  };

  const getAgentCurrentTask = (agentId: string): string | null => {
    if (businessReady === false && agentId === "business_agent") {
      return "Complete onboarding to activate";
    }
    const agentState = agentStates.find((s) => s.agent_name === agentId);
    return agentState?.current_task ?? null;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto h-[calc(100vh-120px)] min-h-[700px]">
      {/* LEFT PANEL: DAG & Logs */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Phase 1 banner */}
        {businessReady === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Business setup required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Complete the onboarding process to unlock all agents and start orchestrating your store.
              </p>
            </div>
            <Link
              href={`/business/${businessId}/onboarding`}
              className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Go to Onboarding →
            </Link>
          </div>
        )}

        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-xl p-8 flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="flex justify-between items-start mb-8">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
              {runningAgentCount > 1
                ? `${runningAgentCount} agents running concurrently`
                : primaryActive
                  ? `Active · ${primaryActive.type.replace(/_/g, " ")}`
                  : "Active Workflow · None"}
            </div>
            <button
              onClick={() => refreshData()}
              disabled={isRefreshing}
              className="p-1 hover:bg-neutral-200 rounded-md transition-colors"
              title="Refresh status"
            >
              <RefreshCw size={14} className={`text-neutral-400 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex flex-col items-center relative z-10 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden">
            {AGENTS.map((agent, i) => {
              const status = getAgentStatus(agent.id);
              const currentTask = getAgentCurrentTask(agent.id);
              const pendingApproval = awaitingApproval.find((wf) => wf.target_agent === agent.id);
              const isActive = status === "Running" || status === "Waiting";
              const isError = status === "Error";
              const isSetupRequired = status === "Setup Required";
              const isLocked = status === "Locked";
              const Icon = agent.icon;

              return (
                <div key={agent.id} className="flex flex-col items-center">
                  <div
                    className={`group w-80 rounded-xl p-4 border transition-all duration-300 ${
                      agent.id === "orchestrator"
                        ? "bg-[#141412] border-[#2A2A27] text-white shadow-lg"
                        : isLocked
                          ? "bg-white/40 border-[#E8E7E2] opacity-40 cursor-not-allowed select-none"
                          : isSetupRequired
                            ? "bg-amber-50 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] cursor-pointer hover:shadow-md"
                            : isError
                              ? "bg-white border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.1)] cursor-pointer hover:shadow-md"
                              : pendingApproval
                                ? "bg-white border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.2)] scale-[1.02] cursor-pointer hover:shadow-md"
                                : isActive
                                  ? "bg-white border-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.15)] scale-[1.02] cursor-pointer hover:shadow-md"
                                  : "bg-white/60 border-[#E8E7E2] opacity-70 cursor-pointer hover:opacity-90 hover:shadow-sm"
                    }`}
                    onClick={() => {
                      if (agent.id === "orchestrator" || isLocked) return;
                      if (isSetupRequired) {
                        router.push(`/business/${businessId}/onboarding`);
                        return;
                      }
                      const tab = AGENT_ROUTES[agent.id];
                      if (tab) router.push(`/business/${businessId}/${tab}`);
                    }}
                  >
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

                      <div className="flex items-center gap-1.5">
                        {isLocked ? (
                          <Lock size={13} className="text-neutral-300" />
                        ) : isSetupRequired ? (
                          <div className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 animate-pulse">
                            Setup Required
                          </div>
                        ) : pendingApproval ? (
                          <div className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                            Awaiting
                          </div>
                        ) : status !== "Idle" && (
                          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            status === "Running" ? "bg-amber-100 text-amber-700" :
                            status === "Waiting" ? "bg-blue-100 text-blue-700" :
                            status === "Error"   ? "bg-red-100 text-red-600" :
                            "bg-neutral-100 text-neutral-600"
                          }`}>
                            {status}
                          </div>
                        )}
                        {agent.id !== "orchestrator" && !isLocked && (
                          <ExternalLink size={11} className="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                        )}
                      </div>
                    </div>

                    {agent.id === "orchestrator" && primaryActive && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <div className="text-[10px] bg-[#2A2A27] px-2 py-1 rounded text-neutral-300">
                          {primaryActive.type}
                        </div>
                        <div className="text-[10px] bg-[#2A2A27] px-2 py-1 rounded text-neutral-300">
                          {primaryActive.state}
                        </div>
                        {runningAgentCount > 1 && (
                          <div className="text-[10px] bg-purple-900 px-2 py-1 rounded text-purple-300">
                            {runningAgentCount} concurrent
                          </div>
                        )}
                      </div>
                    )}

                    {isSetupRequired && (
                      <div className="mt-3 text-[10px] text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle size={11} />
                        {currentTask}
                      </div>
                    )}

                    {status === "Running" && agent.id !== "orchestrator" && (
                      <div className="mt-3">
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#C9A84C] h-full w-2/3 animate-pulse rounded-full" />
                        </div>
                        <div className="text-[10px] text-amber-600 mt-2 font-medium">
                          {currentTask ?? "Agent executing logic..."}
                        </div>
                      </div>
                    )}

                    {status === "Waiting" && agent.id !== "orchestrator" && (
                      <div className="mt-3 text-[10px] text-blue-600 font-medium flex items-center gap-1">
                        <Clock size={11} />
                        {currentTask ?? "Waiting for dependency..."}
                      </div>
                    )}

                    {isError && agent.id !== "orchestrator" && (
                      <div className="mt-3 text-[10px] text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle size={11} />
                        {currentTask ?? "Last run encountered an error"}
                      </div>
                    )}

                    {pendingApproval && (
                      <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between">
                        <div className="text-[10px] text-blue-600 font-medium">
                          {pendingApproval.type.replace(/_/g, " ")}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(pendingApproval.id); }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded-md transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>

                  {i < AGENTS.length - 1 && (
                    <div className={`w-0.5 h-8 transition-colors duration-300 ${isActive ? "bg-[#C9A84C]" : "bg-[#E8E7E2]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT WORKFLOWS */}
        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-xl p-6 overflow-hidden flex flex-col h-[180px]">
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
                    {wf.target_agent?.replace("_agent", "") || "system"}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono">
                  {new Date(wf.created_at).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
            <div className={`w-2 h-2 rounded-full ${
              !realBusinessId
                ? "bg-neutral-300 animate-pulse"
                : businessReady
                  ? "bg-green-500"
                  : "bg-amber-400 animate-pulse"
            }`} />
            <span className="text-xs text-neutral-500 font-medium">
              {!realBusinessId ? "Connecting..." : businessReady ? "Connected" : "Setup Required"}
            </span>
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
                {msg.role === "ai" ? <MarkdownText content={msg.text} /> : msg.text}
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

        {/* Active pipelines indicator */}
        {currentActives.length > 0 && (
          <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
            {currentActives.length > 1 ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {currentActives.length} pipelines running
                </div>
                {currentActives.slice(0, 3).map((w) => (
                  <div key={w.id} className="text-[10px] text-amber-600 pl-3">
                    · {w.target_agent?.replace("_agent", "") ?? "system"}: {w.state}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {currentActives[0].target_agent?.replace("_", " ")}: {currentActives[0].state}...
              </div>
            )}
          </div>
        )}

        {/* Setup required nudge inside chat panel */}
        {businessReady === false && (
          <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
            <p className="text-xs text-amber-700 font-medium">Agents locked until setup is complete.</p>
            <Link
              href={`/business/${businessId}/onboarding`}
              className="shrink-0 text-[10px] font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Start Onboarding →
            </Link>
          </div>
        )}

        <div className="p-4 border-t border-[#E8E7E2] bg-white rounded-b-xl">
          <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E8E7E2] rounded-lg p-2 focus-within:border-[#C9A84C] transition-all shadow-inner">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                !realBusinessId
                  ? "Connecting to store..."
                  : businessReady === false
                    ? "Ask about your setup..."
                    : "Ask the orchestrator..."
              }
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
