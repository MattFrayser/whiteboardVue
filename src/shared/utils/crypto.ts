export function generateSecureRoomCode(length: number = 6): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const values = new Uint8Array(length)

    crypto.getRandomValues(values)

    // Map random values to charset
    let result = ''
    for (let i = 0; i < length; i++) {
        // Use modulo to map to charset range
        // Note: introduces slight bias (< 0.5%) for non-power-of-2 charsets,
        result += charset[values[i]! % charset.length]
    }

    return result
}

export function generateSecureHex(bytes: number = 16): string {
    const values = new Uint8Array(bytes)
    crypto.getRandomValues(values)
    return Array.from(values)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
