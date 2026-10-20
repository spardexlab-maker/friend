// Bound cloud requests so a stalled connection can be retried by the sync loop.
export async function cloudFetch(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const cancel = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) cancel();
  else upstream?.addEventListener("abort", cancel, { once: true });
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const timer = setTimeout(() => controller.abort(), url.includes("/functions/v1/") ? 120000 : 30000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Consume under the deadline too: headers alone do not mean a download finished.
    const body = await response.arrayBuffer();
    return new Response(response.status === 204 || response.status === 205 || response.status === 304 ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener("abort", cancel);
  }
}
