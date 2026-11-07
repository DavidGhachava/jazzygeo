const encoder = new TextEncoder();
const sessionSeconds = 30 * 24 * 60 * 60;
const cookieName = 'little_georgian';
const robots = 'noindex, nofollow, noarchive';
const mime = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
};

async function signingKey(password) {
  return crypto.subtle.importKey('raw', encoder.encode(password), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
async function issue(password) {
  const expiry = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  const signature = await crypto.subtle.sign('HMAC', await signingKey(password), encoder.encode(`phrasebook:${expiry}`));
  return `${expiry}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}
async function valid(request, password) {
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)little_georgian=([0-9]+)\.([A-Za-z0-9+/]+={0,2})(?:;|$)/);
  if (!cookie || Number(cookie[1]) <= Date.now() / 1000) return false;
  try {
    const signature = Uint8Array.from(atob(cookie[2]), (letter) => letter.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', await signingKey(password), signature, encoder.encode(`phrasebook:${cookie[1]}`));
  } catch {
    return false;
  }
}
async function matches(password, attempt) {
  if (typeof attempt !== 'string' || attempt.length > 300) return false;
  const [actual, expected] = await Promise.all([attempt, password].map(async (text) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))),
  ));
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}
function locked(error = false, head = false) {
  return new Response(head ? null : `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="${robots}"><meta name="theme-color" content="#fbf8f0"><title>Little Georgian</title>
  <style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:20px;background:#fbf8f0;color:#302e27;font-family:system-ui,sans-serif}
  main{width:min(100%,410px);padding:clamp(22px,6vw,40px);border:1px solid #e6d8c8;border-radius:25px;background:#fffdf8;box-shadow:0 12px 36px #4a34260a}
  .mark{display:grid;place-items:center;background:#edd1c8;color:#693f40;width:46px;height:46px;border-radius:13px;font-size:25px;font-weight:750;margin-bottom:17px}
  .tag{font-size:11px;font-weight:750;letter-spacing:.14em;color:#89534f}h1{font:500 clamp(35px,8vw,48px)/1 Georgia,serif;letter-spacing:-.04em;margin:8px 0 12px}
  p{color:#686456;line-height:1.55;margin:0 0 19px}label{display:block;margin-bottom:6px;font-size:13px;font-weight:750}
  input,button{width:100%;min-height:48px;font:inherit;border-radius:11px}input{padding:8px 12px;border:1px solid #c8baaa;background:#fbf8f0;color:#302e27}
  button{margin-top:10px;border:0;background:#3c5645;color:white;font-weight:700;cursor:pointer}button:hover{background:#304839}input:focus-visible,button:focus-visible{outline:3px solid #a35d59;outline-offset:3px}
  .error{margin:8px 0 0;font-size:14px;color:#9b3d41}
  </style></head><body><main><div class="mark" lang="ka" aria-hidden="true">გ</div><span class="tag">♥ &nbsp; THE LISTENING BOOK</span><h1>Little Georgian</h1>
  <p>Enter your password to open the listening book.</p><form method="post" action="/unlock">
  <label for="password">Phrasebook password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="300" required>
  ${error ? '<p class="error" role="alert">That password didn’t match. Try again.</p>' : ''}<button>Open phrasebook →</button></form></main></body></html>`, {
    status: error ? 401 : 200,
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': robots},
  });
}
function redirect(cookie) {
  return new Response(null, {status: 303, headers: {
    Location: '/', 'Set-Cookie': cookie, 'Cache-Control': 'no-store', 'X-Robots-Tag': robots,
  }});
}
async function audioRange(request, result) {
  const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range || result.status !== 200 || request.method !== 'GET') return new Response(result.body, result);
  const bytes = await result.arrayBuffer();
  const length = bytes.byteLength;
  const start = range[1] ? Number(range[1]) : Math.max(0, length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(length - 1, Number(range[2])) : length - 1;
  const headers = new Headers(result.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.delete('Content-Encoding');
  if (start >= length || start > end) {
    headers.set('Content-Range', `bytes */${length}`);
    headers.delete('Content-Length');
    return new Response(null, {status: 416, headers});
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), {status: 206, headers});
}
async function openAsset(request, password, assets, name) {
  const internal = new URL(request.url);
  internal.pathname = `/_sealed${name}.bin`;
  internal.search = '';
  const result = await assets.fetch(new Request(internal));
  if (!result.ok) return new Response(null, {status: 404});
  const encrypted = new Uint8Array(await result.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`little-georgian-assets:${password}`));
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
  const bytes = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: encrypted.subarray(0, 12), additionalData: encoder.encode(name),
  }, key, encrypted.subarray(12));
  const type = name.slice(name.lastIndexOf('.') + 1);
  return new Response(request.method === 'HEAD' ? null : bytes, {headers: {
    'Content-Type': mime[type],
    'Content-Length': String(bytes.byteLength),
    ...(type === 'mp3' ? {'Accept-Ranges': 'bytes'} : {}),
  }});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const {PHRASEBOOK_PASSWORD: password, ASSETS: assets} = env;
    if (!password) return new Response('The phrasebook is temporarily unavailable.', {status: 503, headers: {'Cache-Control': 'no-store'}});
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    const cookieOptions = `; Path=/; HttpOnly; SameSite=Lax${secure}`;
    if (request.method === 'POST' && ['/unlock', '/lock'].includes(url.pathname)) {
      if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return new Response(null, {status: 403});
      if (url.pathname === '/lock') return redirect(`${cookieName}=; Max-Age=0${cookieOptions}`);
      const body = await request.text();
      const attempt = body.length <= 3000 ? new URLSearchParams(body).get('password') : null;
      if (!await matches(password, attempt)) return locked(true);
      return redirect(`${cookieName}=${await issue(password)}; Max-Age=${sessionSeconds}${cookieOptions}`);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status: 405});
    if (!await valid(request, password)) {
      if (url.pathname === '/' || url.pathname === '/index.html') return locked(false, request.method === 'HEAD');
      return new Response(null, {status: 401, headers: {'Cache-Control': 'no-store', 'X-Robots-Tag': robots}});
    }
    const name = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!/^\/(?:index\.html|style\.css|book\.js|app\.js|favicon\.svg|audio\/(?:words|phrases|extra)\/[a-z0-9-]+\.mp3)$/.test(name)) {
      return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}});
    }
    const result = await openAsset(request, password, assets, name);
    const response = name.startsWith('/audio/')
      ? await audioRange(request, result)
      : new Response(result.body, result);
    response.headers.set('X-Robots-Tag', robots);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};
