import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Bytes at or above this would map to the first letters more often than the rest, so they are drawn again. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

export const randomId = (length: number): string => {
  let id = '';
  while (id.length < length) {
    for (const byte of randomBytes(length - id.length)) {
      if (byte < UNBIASED_LIMIT) id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
};
