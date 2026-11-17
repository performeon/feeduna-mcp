const SCOPES = new Set(['setup:read', 'reports:read', 'reports:write']);
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export class FeedunaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function readConfiguration(env = process.env) {
  const value = env.FEEDUNA_API_URL || 'https://app.feeduna.com';
  let url;
  try {
    if (value !== value.trim() || /[\\?#\s]/u.test(value)) throw new Error();
    url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && env.FEEDUNA_ALLOW_LOCAL_HTTP === '1'))) throw new Error();
  } catch {
    throw new FeedunaError('configuration', 'Set FEEDUNA_API_URL to one trusted HTTPS origin. Local HTTP requires FEEDUNA_ALLOW_LOCAL_HTTP=1.');
  }
  const token = env.FEEDUNA_API_TOKEN;
  if (typeof token !== 'string' || !/^fn_[a-f0-9]{64}$/u.test(token)) {
    throw new FeedunaError('configuration', 'Set FEEDUNA_API_TOKEN to a Feeduna access key.');
  }
  return Object.freeze({ origin: url.origin, token });
}

const messages = {
  400: ['invalid_request', 'Feeduna rejected the request. Check the tool arguments.'],
  401: ['unauthorized', 'Your Feeduna key is invalid, expired or revoked. Create a new one in App setup → Connect your tools.'],
  402: ['subscription_required', 'New feedback requires an active Feeduna trial or subscription. Existing feedback can still be read with the appropriate scope.'],
  403: ['insufficient_scope', 'This Feeduna key does not allow that operation.'],
  404: ['not_found', 'The requested feedback or app is unavailable to this key.'],
  409: ['conflict', 'The request conflicts with existing feedback. Retry a submission with its original receipt ID and unchanged content.'],
  410: ['removed', 'This feedback receipt was removed.'],
  413: ['too_large', 'The request or response exceeds the supported size. Use a smaller page.'],
  429: ['rate_limited', 'Feeduna has reached a request or report allowance. Retry later.'],
  503: ['unavailable', 'Feeduna API access is currently unavailable.'],
};

export class FeedunaApi {
  constructor(config, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    // All paths are constructed by this package, never supplied as URLs by a tool.
    if (!/^\/api\/v1\/(access|setup|reports(?:\/[0-9a-f-]{36})?|export)(?:\?[^#]*)?$/u.test(path)) {
      throw new FeedunaError('invalid_path', 'Unsupported Feeduna operation.');
    }
    const abort = AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(signal ? [signal] : [])]);
    try {
      const response = await this.fetch(this.config.origin + path, {
        method, redirect: 'manual', signal: abort,
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.config.token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new FeedunaError('redirect_refused', 'Feeduna redirected the API request. Check the configured origin; credentials were not forwarded.');
      }
      if (!response.ok) {
        await response.body?.cancel();
        const [code, message] = messages[response.status] || ['api_failure', 'Feeduna could not complete the request. Retry later using the same receipt ID for a submission.'];
        throw new FeedunaError(code, message);
      }
      if (!(response.headers.get('content-type') || '').split(';')[0].trim().match(/^application\/(?:[a-z0-9.+-]+\+)?json$/iu)) {
        await response.body?.cancel();
        throw new FeedunaError('invalid_response', 'Feeduna returned an unsupported response.');
      }
      if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new FeedunaError('response_too_large', 'Feeduna returned too much data. Use a smaller page.');
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body || []) {
        bytes += chunk.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw new FeedunaError('response_too_large', 'Feeduna returned too much data. Use a smaller page.');
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
      return data;
    } catch (error) {
      if (error instanceof FeedunaError) throw error;
      if (abort.aborted) throw new FeedunaError('interrupted', 'The Feeduna request timed out or was cancelled. A submission may have succeeded; retry its original receipt ID and unchanged content.');
      throw new FeedunaError('connection_failed', 'Feeduna could not be reached or returned invalid data. A submission may have succeeded; retry its original receipt ID and unchanged content.');
    }
  }

  async access(signal) {
    const data = await this.request('/api/v1/access', { signal });
    if (typeof data.project_id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(data.project_id) ||
        !Array.isArray(data.scopes) || data.scopes.length < 1 || data.scopes.length > 3 ||
        data.scopes.some(scope => !SCOPES.has(scope)) || new Set(data.scopes).size !== data.scopes.length ||
        typeof data.expires_at !== 'number' || !Number.isFinite(data.expires_at) || data.expires_at <= Date.now() / 1000) {
      throw new FeedunaError('invalid_access', 'Feeduna returned invalid or expired access metadata.');
    }
    return data;
  }
}
