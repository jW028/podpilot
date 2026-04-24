import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

const ENCRYPTED_PREFIX = 'enc.v1';

function isEncryptedTokenValue(value: string) {
  return value.startsWith(`${ENCRYPTED_PREFIX}:`);
}

export function normalizePrintifyTokenInput(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  // Accept common pasted formats like: Bearer <token> or "<token>".
  let token = value.trim().replace(/^Bearer\s+/i, '');
  token = token.replace(/^['"]+|['"]+$/g, '').trim();
  return token;
}

function getEncryptionKey() {
  const secret = process.env.PRINTIFY_CREDENTIALS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('Missing PRINTIFY_CREDENTIALS_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPrintifyToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join(':');
}

export function decryptPrintifyToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return value;
  }

  const [, ivValue, encryptedValue, authTagValue] = value.split(':');

  if (!ivValue || !encryptedValue || !authTagValue) {
    throw new Error('Invalid encrypted Printify token payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );

  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskPrintifyToken(token: string) {
  if (!token) {
    return 'not connected';
  }

  const visible = token.slice(-4);
  return visible ? `****${visible}` : 'connected';
}

export async function resolveBusinessPrintifyToken(supabase: SupabaseClient, businessId: string) {
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('printify_pat_hint')
    .eq('id', businessId)
    .maybeSingle();

  if (businessError || !business) {
    return null;
  }

  const businessData = business as { printify_pat_hint: string | null };
  const storedValue = typeof businessData.printify_pat_hint === 'string' ? businessData.printify_pat_hint : '';
  if (storedValue && isEncryptedTokenValue(storedValue)) {
    const decryptedToken = decryptPrintifyToken(storedValue);
    if (decryptedToken) {
      return normalizePrintifyTokenInput(decryptedToken);
    }
  }

  // Support legacy plaintext token storage if present.
  const legacyToken = normalizePrintifyTokenInput(storedValue);
  if (legacyToken && !legacyToken.includes('*')) {
    return legacyToken;
  }

  return process.env.PRINTIFY_DEV_TOKEN || null;
}
