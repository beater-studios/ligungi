import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Time-based one-time passwords (RFC 6238) as authenticator apps expect them: SHA-1, 6 digits, 30 second steps. */
export const TOTP_STEP_MS = 30_000;
const DIGITS = 6;
const ISSUER = 'ligungi';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (text: string): Buffer => {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new RangeError('Invalid base32 text');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
};

/** A new shared secret: 160 bits, the size RFC 4226 recommends for SHA-1, in base32 for the authenticator app. */
export const newSecret = (): string => base32Encode(randomBytes(20));

export const hotp = (secret: Buffer, counter: number, digits = DIGITS): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(message).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
};

/**
 * The time step a 6-digit code belongs to, accepting one step before or after `now` for clock drift, or `null`.
 * Callers reject steps already used, so a code works only once.
 */
export const matchStep = (secret: string, code: string, now: number): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(now / TOTP_STEP_MS);
  let matched: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    // Every candidate is compared, so the time taken does not tell which one matched.
    if (timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(code))) matched = step;
  }
  return matched;
};

/** The link authenticator apps read from the QR code. */
export const otpauthUri = (account: string, secret: string): string =>
  `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}`;

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_PATTERN = /^[a-z2-7]{10}$/;

/** Single-use codes for a lost phone: 10 base32 characters (50 random bits), shown as `abcde-fghij`. */
export const newRecoveryCodes = (): string[] =>
  Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const code = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });

/** Spaces, dashes and case do not matter when a code is typed back. */
export const normalizeCode = (input: string): string => input.replace(/[\s-]/g, '').toLowerCase();

export const isRecoveryCode = (normalized: string): boolean => RECOVERY_PATTERN.test(normalized);

/** Recovery codes are random and long enough that a plain hash keeps them safe without a slow password hash. */
export const hashRecoveryCode = (normalized: string): string => createHash('sha256').update(normalized).digest('hex');
