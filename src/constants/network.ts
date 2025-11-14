/**
 * Network-related constants
 * Includes API endpoints, retry limits, and network timeouts
 */

// API Endpoints - use Vite's import.meta.env (not process.env for browser)
// Vite automatically loads .env files and exposes variables prefixed with VITE_
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || ''

// Connection Retry Limits
export const MAX_RECONNECT_ATTEMPTS = 3
export const MAX_PASSWORD_ATTEMPTS = 3

// Network Timeouts (milliseconds)
export const RECONNECT_DELAY = 2000
export const AUTH_TIMEOUT = 6000 // 6 seconds - slightly longer than backend's 5s
export const ACK_TIMEOUT = 5000
export const PASSWORD_RETRY_DELAY = 500
