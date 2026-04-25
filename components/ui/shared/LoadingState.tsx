import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

const LoadingState = ({
  message = "Loading...",
  className = "flex items-center justify-center h-96",
}: LoadingStateProps) => {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        {message && <p className="text-neutral-500 text-sm">{message}</p>}
      </div>
    </div>
  );
};

export default LoadingState;
