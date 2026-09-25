/**
 * Zone d'administration distante : /admin et /admin/* (Worker Cloudflare, jamais les pages publiques).
 *
 * Toute requête passe D'ABORD par verifyAccessJwt ; sans configuration complète, l'administration
 * reste fermée (503). Étape 1 : seulement une page de contrôle et /admin/api/session, pour vérifier
 * de bout en bout que Cloudflare Access fonctionne. Le CMS distant arrivera aux étapes suivantes.
 */
import { readAccessConfig, verifyAccessJwt, type AccessEnv, type KeyProvider } from './access';

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function respond(status: number, body: string, contentType: string, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': `${contentType}; charset=utf-8`, ...extra },
  });
}

const text = (status: number, message: string, extra?: Record<string, string>) =>
  respond(status, message, 'text/plain', extra);

export async function handleAdmin(request: Request, env: AccessEnv, getKey?: KeyProvider): Promise<Response> {
  const config = readAccessConfig(env);
  if (!config) {
    console.warn('[admin] configuration Cloudflare Access absente ou invalide : administration fermée');
    return text(503, 'Administration indisponible.');
  }
  let result: Awaited<ReturnType<typeof verifyAccessJwt>>;
  try {
    result = await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'), config, getKey);
  } catch {
    // erreur imprévue (clés illisibles, runtime…) : refus propre, jamais d'ouverture
    result = { ok: false, reason: 'erreur de vérification' };
  }
  if (!result.ok) {
    console.warn(`[admin] accès refusé : ${result.reason}`);
    return text(403, 'Accès refusé.');
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return text(405, 'Méthode non autorisée.', { Allow: 'GET, HEAD' });

  const { pathname } = new URL(request.url);
  if (pathname === '/admin') return text(308, '', { Location: '/admin/' });
  if (pathname === '/admin/') return respond(200, controlPage(result.email), 'text/html');
  if (pathname === '/admin/api/session') {
    return respond(200, JSON.stringify({ email: result.email }), 'application/json');
  }
  return text(404, 'Introuvable.');
}

function controlPage(email: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Administration</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; }
  main { max-width: 32rem; }
  code { overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
  <h1>Accès vérifié</h1>
  <p>Connecté avec Cloudflare Access : <code>${escapeHtml(email)}</code></p>
  <p>L'administration distante du portfolio sera branchée ici aux prochaines étapes.</p>
</main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
