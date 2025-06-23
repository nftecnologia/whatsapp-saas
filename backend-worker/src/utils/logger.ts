export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    
    switch (envLevel) {
      case 'error':
        this.level = LogLevel.ERROR;
        break;
      case 'warn':
        this.level = LogLevel.WARN;
        break;
      case 'info':
        this.level = LogLevel.INFO;
        break;
      case 'debug':
        this.level = LogLevel.DEBUG;
        break;
      default:
        this.level = LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const workerId = process.env.WORKER_ID || 'worker-001';
    
    let logMessage = `[${timestamp}] [${workerId}] ${level}: ${message}`;
    
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    return logMessage;
  }

  error(message: string, data?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, data));
    }
  }

  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }
}

export default new Logger();