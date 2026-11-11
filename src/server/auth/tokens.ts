import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type RandomToken = () => string;

/** 32 random bytes, base64url: the session token and the OAuth state (docs/02 §7). */
export const randomToken: RandomToken = () => randomBytes(32).toString('base64url');

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Constant-time comparison of two strings of any length. */
export function tokensMatch(a: string, b: string): boolean {
  // Hashing first gives equal-length inputs, so length is not leaked either.
  return timingSafeEqual(hashToken(a), hashToken(b));
}
