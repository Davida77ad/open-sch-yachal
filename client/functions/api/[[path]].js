const API_ORIGIN = 'https://open-sch-yachal.onrender.com';

export async function onRequest({ request }) {
  const upstreamUrl = new URL(request.url);
  const apiOrigin = new URL(API_ORIGIN);
  upstreamUrl.protocol = apiOrigin.protocol;
  upstreamUrl.hostname = apiOrigin.hostname;
  upstreamUrl.port = apiOrigin.port;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('content-length');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('access-control-allow-origin');
  responseHeaders.delete('access-control-allow-credentials');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
