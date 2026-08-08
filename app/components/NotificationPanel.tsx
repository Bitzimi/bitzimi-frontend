import { useState } from "react";
import { X, CheckCircle, XCircle, AlertCircle, Bell, Send, ArrowLeftRight, Trash2, CheckSquare, Square } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { motion } from "motion/react";
import { useNotifications } from "../contexts/NotificationContext";

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const {
    notifications, unreadCount,
    markAsRead, markAllAsRead,
    clearNotification, clearSelectedNotifications, clearAllNotifications,
  } = useNotifications();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    await clearSelectedNotifications([...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  const getIcon = (type: string, title?: string) => {
    // Withdrawal: pending/submitted → Send; completed → CheckCircle green
    if (type === "withdrawal") {
      const isCompleted = title?.toLowerCase().includes("complet") || title?.toLowerCase().includes("confirmed");
      return isCompleted
        ? <CheckCircle className="h-5 w-5 text-green-600" />
        : <Send className="h-5 w-5 text-blue-500" />;
    }
    switch (type) {
      case "game_win":
      case "deposit":
      case "vip_activation":
      case "affiliate_earning":
      case "verification_approved":
      case "task_completed":
      case "reward":
      case "daily_streak":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "transfer":
        return <ArrowLeftRight className="h-5 w-5 text-purple-500" />;
      case "game_loss":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "system_alert":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "match_result":
      default:
        return <Bell className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTimeAgo = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Badge className="bg-red-500">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost" size="icon"
                onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
                title={selectMode ? "Cancel selection" : "Select notifications"}
                className="h-8 w-8"
              >
                {selectMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Select-mode toolbar */}
        {selectMode && notifications.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border text-sm">
            <button onClick={handleSelectAll} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              <span>{allSelected ? "Deselect all" : "Select all"}</span>
            </button>
            {selectedIds.size > 0 && (
              <Button
                size="sm" variant="destructive"
                className="ml-auto h-7 text-xs"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete {selectedIds.size}
              </Button>
            )}
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg transition-all ${
                    selectedIds.has(notification.id)
                      ? "bg-primary/8 border-primary/30"
                      : !notification.read
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                        : "bg-gray-50 dark:bg-gray-900"
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Checkbox (select mode) or icon (normal mode) */}
                    <div className="shrink-0 mt-0.5">
                      {selectMode ? (
                        <button
                          onClick={() => toggleSelect(notification.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {selectedIds.has(notification.id)
                            ? <CheckSquare className="h-5 w-5 text-primary" />
                            : <Square className="h-5 w-5" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => !notification.read && markAsRead(notification.id)}
                          className="cursor-default"
                        >
                          {getIcon(notification.type, notification.title)}
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (selectMode) toggleSelect(notification.id);
                        else if (!notification.read) markAsRead(notification.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm">{notification.title}</p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {getTimeAgo(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {notification.message}
                      </p>
                      {!notification.read && !selectMode && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                      )}
                    </div>

                    {/* Per-item delete (normal mode only) */}
                    {!selectMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); clearNotification(notification.id); }}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — management actions */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" className="flex-1 text-xs h-9" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 text-xs h-9 text-destructive hover:text-destructive hover:border-destructive/40"
              onClick={clearAllNotifications}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete all
            </Button>
          </div>
        )}
      </motion.div>
    </>
  );
}