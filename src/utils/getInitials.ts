// ============================================================================
// getInitials — derive up-to-two-letter initials from a display name.
//
// Pure, dependency-free helper shared by the avatar fallbacks in
// ProfileEditSection and PublicProfilePage. Splits on whitespace, drops empty
// segments (guards against an empty string or stray whitespace), takes the
// first character of up to two words, and uppercases the result.
// ============================================================================

/**
 * Builds initials from a display name.
 *
 * @param name - The user's display name (may be empty or whitespace-only).
 * @returns Up to two uppercase initials, or an empty string when no usable
 *   word characters are present.
 *
 * @example
 * getInitials('דני כהן'); // → 'דכ'
 * getInitials('  Ada  Lovelace '); // → 'AL'
 * getInitials(''); // → ''
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}
