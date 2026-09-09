/**
 * PlayerAvatar — the ONLY way to render any player avatar on the platform.
 *
 * Real users use the canonical identity/profile avatar. Uploaded avatars may be
 * returned by the backend as an absolute URL, a backend-relative /uploads URL,
 * or (during the optimistic upload state) a data URL.
 */

interface PlayerAvatarProps {
  avatar: string;
  className?: string;
}

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

/** Resolve backend-relative stored files without treating the storage key as text. */
export function resolveAvatarUrl(value: string): string {
  if (!value) return value;
  if (/^(data:image|https?:\/\/|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${value}` : value;
  return value;
}

export function isImage(value: string): boolean {
  const resolved = resolveAvatarUrl(value);
  return (
    resolved.startsWith("data:image") ||
    resolved.startsWith("http://") ||
    resolved.startsWith("https://") ||
    resolved.startsWith("blob:")
  );
}

export function PlayerAvatar({ avatar, className = "" }: PlayerAvatarProps) {
  const resolved = resolveAvatarUrl(avatar);
  if (isImage(resolved)) {
    return (
      <img
        src={resolved}
        className={`w-full h-full object-cover ${className}`}
        alt=""
      />
    );
  }
  return <span className={className}>{resolved}</span>;
}
