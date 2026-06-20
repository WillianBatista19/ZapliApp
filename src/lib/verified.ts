const VERIFIED = new Set(['incelicasappoficial'])

export function isVerified(username: string): boolean {
  return VERIFIED.has(username)
}
