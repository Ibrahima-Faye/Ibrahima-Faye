/**
 * Module fourni par le runtime Cloudflare Workers (variables et secrets du Worker).
 * Déclaration minimale : le projet n'installe pas @cloudflare/workers-types pour une seule importation.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
