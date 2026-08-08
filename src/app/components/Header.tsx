import { useState } from "react";
import { Bell } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { NotificationPanel } from "./NotificationPanel";
import { OnlineUserCounter } from "./OnlineUserCounter";
import { useNavigate } from "react-router";
import { useIdentity } from "../contexts/IdentityContext";
import { useNotifications } from "../contexts/NotificationContext";

export function Header() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="bg-white dark:bg-sidebar border-b border-gray-200 dark:border-sidebar-border sticky top-0 z-40 shadow-sm dark:shadow-md">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <h2 className="text-lg md:text-2xl font-semibold truncate">
                Welcome back, {identity.username}!
              </h2>
              <div className="hidden lg:block">
                <OnlineUserCounter variant="compact" showLabel={false} />
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 md:h-10 md:w-10"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
                {showNotifications && (
                  <NotificationPanel onClose={() => setShowNotifications(false)} />
                )}
              </div>

              {/* User Profile Icon */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:h-10 md:w-10 rounded-full p-0 relative"
                onClick={() => navigate("/profile")}
              >
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden text-white">
                  <PlayerAvatar avatar={identity.avatar} />
                </div>
                {/* Verified Badge — green seal checkmark */}
                {identity.isVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" fill="#059669" />
                      <circle cx="12" cy="12" r="7" fill="white" />
                      <circle cx="12" cy="12" r="6" fill="#059669" />
                      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
