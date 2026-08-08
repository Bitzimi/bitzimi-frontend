/**
 * Online Users Service
 *
 * Fetches the real registered-user count from the backend public stats endpoint.
 * Falls back to 1 (current user) when backend is unreachable.
 *
 * Source: GET /api/v1/public/stats → data.totalUsers
 * Future: replace with real-time WebSocket presence when available.
 */

const _OUS_API = (import.meta as any).env?.VITE_API_URL as string | undefined;

class OnlineUsersService {
  private _count = 0;

  constructor() {
    this._fetch();
    setInterval(() => this._fetch(), 120_000); // refresh every 2 min
  }

  private async _fetch() {
    if (!_OUS_API) return;
    try {
      const res = await fetch(`${_OUS_API}/api/v1/public/stats`);
      if (!res.ok) return;
      const json = await res.json();
      if (typeof json.data?.totalUsers === "number") {
        this._count = json.data.totalUsers;
      }
    } catch {}
  }

  public getOnlineCount(): number {
    return this._count || 1; // fallback to 1 if backend not yet reached
  }

  public forceUpdate(): number {
    this._fetch();
    return this.getOnlineCount();
  }
}

export const onlineUsersService = new OnlineUsersService();
