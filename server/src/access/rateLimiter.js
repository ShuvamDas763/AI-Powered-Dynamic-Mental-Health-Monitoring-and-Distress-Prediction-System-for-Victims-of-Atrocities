/**
 * In-memory sliding-window rate limiter middleware.
 *
 * SECURITY PURPOSE
 * -------------------------------------------------------------------------
 * Protects public endpoints (authentication, check-in submission, crisis routes)
 * against brute-force attacks, credential stuffing, and flood denial-of-service.
 *
 * Implemented with zero external dependencies, making it suitable for both
 * local development, testing, and memory-constrained hackathon deployments.
 */

/**
 * Creates an Express middleware that rate limits requests.
 *
 * @param {object} options
 * @param {number} options.windowMs Time window in milliseconds (default: 60000 = 1 min)
 * @param {number} options.maxRequests Maximum requests allowed within windowMs (default: 30)
 * @param {string} [options.message] Custom error response message
 * @param {(req: import('express').Request) => string} [options.keyGenerator] Custom key generator
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 30;
  const message = options.message ?? 'Too many requests. Please slow down and try again later.';
  const keyGenerator = options.keyGenerator ?? ((req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');

  // Map of client key -> Array of request timestamps
  const hits = new Map();

  // Periodic cleanup of expired windows to prevent memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, Math.max(windowMs, 30_000));

  // Do not prevent process exit in tests
  if (interval.unref) interval.unref();

  return function rateLimiterMiddleware(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();
    const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: message });
    }

    timestamps.push(now);
    hits.set(key, timestamps);

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(maxRequests - timestamps.length));

    next();
  };
}

/** Preconfigured limiter for login attempts (15 per 15 minutes) */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
});

/** Preconfigured limiter for check-in submissions (40 per minute) */
export const checkinLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: 'Check-in submission rate limit exceeded. Please wait before submitting again.',
});
