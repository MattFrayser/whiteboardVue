/**
 * Structured logging utility for frontend
 * Environment-aware with log levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

class Logger {
    private currentLevel: LogLevel
    private environment: string

    constructor() {
        // Determine environment from import.meta.env (Vite)
        this.environment = import.meta.env.MODE || 'development'

        // Set log level based on environment variable or default
        const envLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase()
        switch (envLevel) {
            case 'DEBUG':
                this.currentLevel = LogLevel.DEBUG
                break
            case 'INFO':
                this.currentLevel = LogLevel.INFO
                break
            case 'WARN':
            case 'WARNING':
                this.currentLevel = LogLevel.WARN
                break
            case 'ERROR':
                this.currentLevel = LogLevel.ERROR
                break
            case 'NONE':
                this.currentLevel = LogLevel.NONE
                break
            default:
                // Default: debug in development, info in production
                this.currentLevel = this.environment === 'production'
                    ? LogLevel.INFO
                    : LogLevel.DEBUG
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLevel
    }

    private formatMessage(level: string, component: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString()
        let formatted = `[${timestamp}] ${level} [${component}] ${message}`
        if (data !== undefined) {
            formatted += ` ${JSON.stringify(data)}`
        }
        return formatted
    }

    debug(component: string, message: string, data?: any): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(this.formatMessage('DEBUG', component, message, data))
        }
    }

    info(component: string, message: string, data?: any): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('INFO', component, message, data))
        }
    }

    warn(component: string, message: string, data?: any): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', component, message, data))
        }
    }

    error(component: string, message: string, error?: Error | any): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorData = error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error
            console.error(this.formatMessage('ERROR', component, message, errorData))
        }
    }

    /**
     * Create a scoped logger for a specific component
     */
    scope(component: string) {
        return {
            debug: (message: string, data?: any) => this.debug(component, message, data),
            info: (message: string, data?: any) => this.info(component, message, data),
            warn: (message: string, data?: any) => this.warn(component, message, data),
            error: (msg: string, error?: Error | any) => this.error(component, msg, error)
        }
    }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions
export const createLogger = (component: string) => logger.scope(component)
