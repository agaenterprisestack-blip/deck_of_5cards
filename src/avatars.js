// Profile pictures, shared by the app and the server so both agree on what is allowed.
// Stored as text: "initials:<colour>", "emoji:<colour>:<emoji>", or a small photo data URL.
export const avatarEmoji = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🐵', '🦄', '🐙', '🐧', '🦉', '🐲', '👑', '🎩', '⭐', '🔥', '🍀', '🎯', '🚀', '😎'];
export const avatarColors = ['#e8bda0', '#c9d8b6', '#c7c5df', '#efd9a8', '#c4dce3', '#f0b8c0', '#b9d9c9', '#d7c2a8'];
export const MAX_PHOTO_LENGTH = 60_000;

export function parseAvatar(value) {
  if (typeof value !== 'string') return null;
  const initials = /^initials:([0-7])$/.exec(value);
  if (initials) return { kind: 'initials', color: Number(initials[1]) };
  const emoji = /^emoji:([0-7]):(.+)$/u.exec(value);
  if (emoji && avatarEmoji.includes(emoji[2])) return { kind: 'emoji', color: Number(emoji[1]), emoji: emoji[2] };
  if (value.length <= MAX_PHOTO_LENGTH && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return { kind: 'photo', src: value };
  return null;
}
