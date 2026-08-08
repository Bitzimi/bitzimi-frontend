import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { onlineUsersService } from "../services/onlineUsersService";

interface OnlineUserCounterProps {
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  variant?: "default" | "compact" | "badge";
}

export function OnlineUserCounter({
  className = "",
  showIcon = true,
  showLabel = true,
  variant = "default",
}: OnlineUserCounterProps) {
  const [onlineCount, setOnlineCount] = useState(onlineUsersService.getOnlineCount());

  useEffect(() => {
    // Update count every second
    const interval = setInterval(() => {
      setOnlineCount(onlineUsersService.getOnlineCount());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format number with commas
  const formatCount = (count: number): string => {
    return count.toLocaleString();
  };

  // Variant: Compact (for header/navbar)
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {showIcon && (
          <div className="relative">
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {formatCount(onlineCount)}
        </span>
        {showLabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400">online</span>
        )}
      </div>
    );
  }

  // Variant: Badge (inline badge style)
  if (variant === "badge") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 rounded-full ${className}`}>
        {showIcon && (
          <div className="relative">
            <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
        <span className="text-xs font-bold text-green-700 dark:text-green-300">
          {formatCount(onlineCount)}
        </span>
        {showLabel && (
          <span className="text-xs text-green-600 dark:text-green-400">online</span>
        )}
      </div>
    );
  }

  // Variant: Default (full card-style display)
  return (
    <div className={`flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800 ${className}`}>
      {showIcon && (
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full animate-pulse" />
        </div>
      )}
      <div>
        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
          {formatCount(onlineCount)}
        </div>
        {showLabel && (
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
            Users Online Now
          </div>
        )}
      </div>
    </div>
  );
}
