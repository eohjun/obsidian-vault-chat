import { describe, it, expect } from 'vitest';
import { executeWithRetry } from '../src/core/application/services/retry-service';

describe('executeWithRetry', () => {
  it('returns result on first success', async () => {
    const result = await executeWithRetry(
      () => Promise.resolve('ok'),
      () => true
    );
    expect(result).toBe('ok');
  });

  it('retries and succeeds', async () => {
    let attempts = 0;
    const result = await executeWithRetry(
      () => {
        attempts++;
        if (attempts < 3) throw new Error('RATE_LIMIT');
        return Promise.resolve('ok');
      },
      (err) => err instanceof Error && err.message.includes('RATE_LIMIT'),
      { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws immediately on non-retryable error', async () => {
    await expect(
      executeWithRetry(
        () => { throw new Error('AUTH_ERROR'); },
        (err) => err instanceof Error && err.message.includes('RATE_LIMIT'),
        { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 }
      )
    ).rejects.toThrow('AUTH_ERROR');
  });

  it('throws after max retries exhausted', async () => {
    await expect(
      executeWithRetry(
        () => { throw new Error('RATE_LIMIT'); },
        () => true,
        { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 }
      )
    ).rejects.toThrow('RATE_LIMIT');
  });
});
