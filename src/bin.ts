#!/usr/bin/env
import crypto from 'crypto'

console.log(generateSecretKey())

/**
 * Generates a 32-byte-long random key that can be used for signing cookies
 * using SHA-256 HMAC.
 *
 * Thanks to: https://github.com/crypto-utils/keygrip/issues/26
 *
 * @returns {string} - Random series of 32 bytes encoded in base64.
 */
export function generateSecretKey ():string {
    return crypto.randomBytes(32).toString('base64')
}
