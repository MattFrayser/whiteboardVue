/**
 * Cryptographic utilities using Web Crypto API
 */

/**
 * Generates a cryptographically secure random room code
 * Uses Web Crypto API for secure random number generation
 * @param length - Length of the room code (default: 6)
 * @returns A random alphanumeric room code in uppercase
 */
export function generateSecureRoomCode(length: number = 6): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const values = new Uint8Array(length)

    // Generate cryptographically secure random values
    crypto.getRandomValues(values)

    // Map random values to charset
    let result = ''
    for (let i = 0; i < length; i++) {
        // Use modulo to map to charset range
        // Note: This introduces slight bias for non-power-of-2 charsets,
        // but it's acceptable for room codes (bias is < 0.5%)
        result += charset[values[i]! % charset.length]
    }

    return result
}

/**
 * Generates a cryptographically secure random hex string
 * @param bytes - Number of random bytes to generate (default: 16)
 * @returns A hexadecimal string
 */
export function generateSecureHex(bytes: number = 16): string {
    const values = new Uint8Array(bytes)
    crypto.getRandomValues(values)
    return Array.from(values)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
