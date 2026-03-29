export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class RateLimitError extends AIError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT', true);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends AIError {
  constructor(message: string = 'Invalid API key') {
    super(message, 'AUTH_ERROR', false);
    this.name = 'AuthenticationError';
  }
}

export class TimeoutError extends AIError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

export class VaultEmbeddingsUnavailableError extends Error {
  constructor() {
    super('Vault Embeddings plugin is not installed or not configured');
    this.name = 'VaultEmbeddingsUnavailableError';
  }
}
