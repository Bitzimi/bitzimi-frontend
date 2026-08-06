/**
 * PlayerAvatar — the ONLY way to render any player avatar on the platform.
 *
 * Sources:
 *   Real user  → identity.avatar  (always set: uploaded image OR first letter of username)
 *   Bot player → bot.avatar       (first letter of bot name, e.g. "A")
 *
 * Rendering logic:
 *   If `avatar` is an image (data:, http://, https://, blob:) → <img>
 *   Otherwise → render the text character as-is
 *
 * Usage:
 *   <PlayerAvatar avatar={identity.avatar} />           // real user
 *   <PlayerAvatar avatar={player.avatar} />             // bot (single letter)
 *   <PlayerAvatar avatar={isCurrentUser ? identity.avatar : player.avatar} />
 */

interface PlayerAvatarProps {
  avatar: string;
  className?: string;
}

export function isImage(value: string): boolean {
  return (
    value.startsWith("data:image") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  );
}

export function PlayerAvatar({ avatar, className = "" }: PlayerAvatarProps) {
  if (isImage(avatar)) {
    return (
      <img
        src={avatar}
        className={`w-full h-full object-cover ${className}`}
        alt=""
      />
    );
  }
  return <span className={className}>{avatar}</span>;
}
