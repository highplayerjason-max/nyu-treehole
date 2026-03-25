export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_CHANGE_COOLDOWN_HOURS = 24;
export const DISPLAY_NAME_CHANGE_COOLDOWN_MS =
  DISPLAY_NAME_CHANGE_COOLDOWN_HOURS * 60 * 60 * 1000;

export function getDisplayNameChangeNextAllowedAt(
  changedAt: Date | null | undefined
) {
  if (!changedAt) {
    return null;
  }

  return new Date(changedAt.getTime() + DISPLAY_NAME_CHANGE_COOLDOWN_MS);
}

export function canChangeDisplayName(
  changedAt: Date | null | undefined,
  now = new Date()
) {
  const nextAllowedAt = getDisplayNameChangeNextAllowedAt(changedAt);

  return {
    allowed: !nextAllowedAt || nextAllowedAt <= now,
    nextAllowedAt,
  };
}
