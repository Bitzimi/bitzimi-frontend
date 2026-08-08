import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// ── Backend helpers ────────────────────────────────────────────────────────────
const _NF_API   = (import.meta as any).env?.VITE_API_URL as string | undefined;
const _nfToken  = () => localStorage.getItem("bitzimi_access_token");
const _nfFetch  = async (path: string, opts?: RequestInit) => {
  const token = _nfToken();
  if (!_NF_API || !token) return null;
  const res = await fetch(`${_NF_API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok || res.status === 204) return null;
  return res.json();
};
const _fromBackend = (n: any): Notification => ({
  id:        n.id,
  type:      n.type as NotificationType,
  title:     n.title,
  message:   n.message,
  timestamp: n.createdAt ?? n.timestamp ?? new Date().toISOString(),
  read:      !!n.read,
  metadata:  n.metadata ?? undefined,
});

export type NotificationType =
  // Games
  | "game_win"
  | "game_loss"
  | "match_result"
  // Finance
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "reward"
  | "reward_credited"
  // Account & Security
  | "security"
  | "success"
  | "vip_activation"
  | "affiliate_earning"
  | "verification_approved"
  | "daily_streak"
  | "system_alert"
  // Task Marketplace
  | "task_created"
  | "task_approved"
  | "task_rejected"
  | "task_completed"
  | "proof_submitted"
  | "proof_approved"
  | "proof_rejected"
  | "campaign_completed";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, message: string, metadata?: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearSelectedNotifications: (ids: string[]) => void;
  clearAllNotifications: () => void;
  refreshFromBackend: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage cache (offline fallback)
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const s = localStorage.getItem("bitzimiNotifications");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  // Write-through: keep localStorage in sync as an offline cache
  useEffect(() => {
    try { localStorage.setItem("bitzimiNotifications", JSON.stringify(notifications)); } catch {}
  }, [notifications]);

  // ── Backend sync ─────────────────────────────────────────────────────────────
  const refreshFromBackend = useCallback(async () => {
    if (!_NF_API || !_nfToken()) return;
    try {
      const json = await _nfFetch("/api/v1/notifications?limit=50");
      if (!json?.data?.items) return;
      const backendItems: Notification[] = json.data.items.map(_fromBackend);
      setNotifications(prev => {
        // Keep local-only optimistic items (id starts with "local_") not yet persisted
        const backendIds = new Set(backendItems.map(n => n.id));
        const localOnly  = prev.filter(n => !backendIds.has(n.id) && n.id.startsWith("local_"));
        const merged = [...backendItems, ...localOnly]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 100);
        try { localStorage.setItem("bitzimiNotifications", JSON.stringify(merged)); } catch {}
        return merged;
      });
    } catch {}
  }, []);

  // Fetch from backend on mount
  useEffect(() => { refreshFromBackend(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new notifications every 30 s
  useEffect(() => {
    if (!_NF_API || !_nfToken()) return;
    const id = setInterval(refreshFromBackend, 30_000);
    return () => clearInterval(id);
  }, [refreshFromBackend]);

  // Optimistic local add — local_ prefix, replaced by backend on next sync
  const addNotification = (type: NotificationType, title: string, message: string, metadata?: any) => {
    const n: Notification = {
      id:        `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type, title, message, metadata,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [n, ...prev].slice(0, 100));
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (!id.startsWith("local_")) {
      await _nfFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await _nfFetch("/api/v1/notifications/read-all", { method: "POST" });
  };

  const clearNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!id.startsWith("local_")) {
      await _nfFetch(`/api/v1/notifications/${id}`, { method: "DELETE" });
    }
  };

  // Delete a selected subset of notifications — calls individual DELETE for each backend ID
  const clearSelectedNotifications = async (ids: string[]) => {
    const idSet = new Set(ids);
    setNotifications(prev => prev.filter(n => !idSet.has(n.id)));
    const backendIds = ids.filter(id => !id.startsWith("local_"));
    await Promise.all(
      backendIds.map(id => _nfFetch(`/api/v1/notifications/${id}`, { method: "DELETE" }))
    );
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    localStorage.removeItem("bitzimiNotifications");
    await _nfFetch("/api/v1/notifications/all", { method: "DELETE" });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      addNotification, markAsRead, markAllAsRead,
      clearNotification, clearSelectedNotifications, clearAllNotifications,
      refreshFromBackend,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
