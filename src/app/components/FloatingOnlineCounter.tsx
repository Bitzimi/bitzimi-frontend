import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { onlineUsersService } from "../services/onlineUsersService";

/**
 * Floating online user counter that appears at the top-right of the page on mobile
 * Hidden on desktop (lg+) since desktop shows it in the header
 */
export function FloatingOnlineCounter() {
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

  return (
    <div className="lg:hidden fixed top-16 right-4 z-30">
      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full shadow-lg border border-green-200 dark:border-green-800">
        <div className="relative">
          <Users className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-green-500 rounded-full animate-pulse" />
        </div>
        <span className="text-[10px] font-bold text-green-700 dark:text-green-300">
          {formatCount(onlineCount)}
        </span>
      </div>
    </div>
  );
}
