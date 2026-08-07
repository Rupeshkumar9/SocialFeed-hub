export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export async function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'same-origin',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      signal: options.signal || controller.signal,
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = null; }
    }
    if (!response.ok) {
      const errorPayload = payload?.error;
      const message = typeof errorPayload === 'object' ? errorPayload.message : errorPayload;
      const code = typeof errorPayload === 'object' ? errorPayload.code : null;
      throw new ApiError(message || ('Request failed with status ' + response.status + '.'), {
        status: response.status,
        code: code || (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 503 ? 'DATABASE_UNAVAILABLE' : 'REQUEST_FAILED'),
        retryable: response.status >= 500,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timedOut = error?.name === 'AbortError';
    throw new ApiError(timedOut ? 'The request timed out.' : 'Unable to reach the server.', {
      code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
