/**
 * A stable hue for a username, so the same person is always the same colour and two
 * people in a list are easy to tell apart. Any hash would do; this one is small,
 * deterministic and spreads short names well.
 */
export function avatarHue(username: string | undefined | null): number {
  if (!username) {
    return 245;
  }
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) % 360;
  }
  return hash;
}
