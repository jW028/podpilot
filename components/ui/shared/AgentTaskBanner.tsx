"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";

interface PipelineTask {
  id: string;
  state: string;
  result: { context?: string; userMessage?: string } | null;
  payload: { context?: string; userMessage?: string };
}

interface AgentTaskBannerProps {
  businessId: string;
  agent: string;
  onAccept: (task: PipelineTask) => void;
  label?: string;
}

const AgentTaskBanner = ({ businessId, agent, onAccept, label }: AgentTaskBannerProps) => {
  const [task, setTask] = useState<PipelineTask | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/business/${businessId}/agent-tasks?agent=${agent}`);
        if (!res.ok) return;
        const data = (await res.json()) as { task: PipelineTask | null };
        if (!cancelled && data.task) setTask(data.task);
      } catch {
        // silently ignore
      }
    };

    fetchTask();
    return () => { cancelled = true; };
  }, [businessId, agent]);

  if (!task || dismissed) return null;

  const context =
    task.result?.context ??
    task.payload?.context ??
    task.result?.userMessage ??
    task.payload?.userMessage ??
    "Orchestrator has a task for you.";

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl mb-4">
      <Sparkles className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary-700 mb-0.5">Orchestrator task</p>
        <p className="text-xs text-primary-600 line-clamp-2">{context}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onAccept(task)}
          className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors"
        >
          {label ?? "Start"}
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-primary-400 hover:text-primary-600 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AgentTaskBanner;
