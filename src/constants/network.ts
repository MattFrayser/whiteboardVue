/**
 * Network-related constants
 * Includes API endpoints, retry limits, and network timeouts
 */

// API Endpoints
export const API_BASE_URL = 'http://localhost:8080'
export const WS_BASE_URL = 'ws://localhost:8080'

// Connection Retry Limits
export const MAX_RECONNECT_ATTEMPTS = 3
export const MAX_PASSWORD_ATTEMPTS = 3

// Network Timeouts (milliseconds)
export const RECONNECT_DELAY = 2000
export const AUTH_TIMEOUT = 6000 // 6 seconds - slightly longer than backend's 5s
export const ACK_TIMEOUT = 5000
export const PASSWORD_RETRY_DELAY = 500
