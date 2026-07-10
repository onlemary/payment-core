// src/oauth/state.ts
//
// DECISIÓN DE DISEÑO — state OAuth = HMAC firmado (no nonce-en-cookie).
// Por qué: el objetivo primario es blindar la validación de unicidad
// user_id↔org del connect (Issue 1), que necesita INTEGRIDAD del orgSlug.
// El HMAC lo da stateless, sin infra de cookie/sesión. El connect lo inicia
// un admin ya autenticado, así que el riesgo de CSRF puro es bajo.
// Alternativa evaluada: nonce-en-cookie (estándar Stripe/Shopify) → más
// robusto anti-CSRF pero requiere infra de sesión. Descartado por costo/beneficio.
// Ref: SDK oficial MP define state como "opaque value for CSRF". PKCE descartado
// (es de otro flujo, el onboarding propietario, no del OAuth crudo).
// >>> Si se cambia de método, se cambia SOLO este módulo. <<<
//
// Este módulo es la ÚNICA fuente de verdad del formato del state OAuth.
// Es provider-agnóstico: el secreto se inyecta como parámetro (no se lee de env
// acá) para que la capa genérica no dependa de MercadoPago ni de ningún provider.

import { createHmac, timingSafeEqual } from 'crypto'

/** Tiempo de vida del state firmado: 10 minutos. */
const EXP_MS = 10 * 60 * 1000

/**
 * Firma HMAC-SHA256 (hex) sobre el payload `orgSlug:exp` con el secreto dado.
 */
function computeHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Genera un state OAuth firmado con el formato `orgSlug:exp:hmac`.
 *
 * - `exp` = timestamp (ms) de expiración = ahora + 10 minutos.
 * - `hmac` = HMAC-SHA256 (hex) sobre `orgSlug:exp` con el `secret`.
 *
 * NOTA sobre el formato: el `orgSlug` se deja EN TEXTO PLANO (sin base64) porque
 * los orgSlugs son slugs `[a-z0-9-]` que NO contienen `:`, así que el separador
 * `:` nunca colisiona. Si alguna vez se permiten orgSlugs con `:`, este formato
 * debe revisarse.
 *
 * @param orgSlug - Identificador de la organización (slug) a embeber en el state.
 * @param secret - Secreto del servidor para firmar (ej. MERCADOPAGO_WEBHOOK_SECRET).
 * @returns State firmado `orgSlug:exp:hmac`.
 */
export function signState(orgSlug: string, secret: string): string {
  const exp = Date.now() + EXP_MS
  const payload = `${orgSlug}:${exp}`
  const hmac = computeHmac(payload, secret)
  return `${payload}:${hmac}`
}

/**
 * Verifica un state OAuth firmado.
 *
 * Comprueba, en orden:
 *  (a) que la firma HMAC sea válida (comparación TIMING-SAFE),
 *  (b) que no haya expirado (`exp > Date.now()`),
 *  (c) que el `orgSlug` embebido coincida con `expectedOrgSlug`.
 *
 * NUNCA lanza ante un input malformado: devuelve `false`.
 *
 * @param state - State recibido en el callback (`orgSlug:exp:hmac`).
 * @param expectedOrgSlug - orgSlug esperado (fuente confiable, ej. el path).
 * @param secret - El mismo secreto usado en `signState`.
 * @returns `true` si el state es válido, íntegro, no expirado y coincide.
 */
export function verifyState(state: string, expectedOrgSlug: string, secret: string): boolean {
  if (typeof state !== 'string') return false

  // Formato: orgSlug:exp:hmac (exactamente 3 partes; orgSlug no contiene ':').
  const parts = state.split(':')
  if (parts.length !== 3) return false

  const [orgSlug, expStr, hmac] = parts
  if (!orgSlug || !expStr || !hmac) return false

  // (a) Firma válida (timing-safe).
  const expected = computeHmac(`${orgSlug}:${expStr}`, secret)
  if (expected.length !== hmac.length) return false
  const equal = timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(hmac, 'utf8'))
  if (!equal) return false

  // (b) No expirado.
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false

  // (c) orgSlug embebido coincide con el esperado.
  if (orgSlug !== expectedOrgSlug) return false

  return true
}
