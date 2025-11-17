import bcrypt from 'bcryptjs'

export async function hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || typeof plainPassword !== 'string') {
        throw new Error('Invalid password')
    }
    
    // Validate password strength (optional but recommended)
    if (plainPassword.length < 4) {
        throw new Error('Password must be at least 4 characters')
    }
    
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(plainPassword, salt)
    return hashedPassword
}
