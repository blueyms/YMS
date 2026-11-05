/** 前端 JWT 工具：HS256 签名 / 验签 / Base64URL 编解码（Web Crypto 优先，纯 JS 降级） */

import { hmacSha256Fallback } from './sha256';

export const DEMO_SECRET = 'yms-demo-secret-2026';

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToBytes = (segment: string): Uint8Array<ArrayBuffer> => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const encodeText = (text: string): string => bytesToBase64Url(textEncoder.encode(text));

export const decodeText = (segment: string): string => textDecoder.decode(base64UrlToBytes(segment));

/** 计算 HMAC-SHA256，Web Crypto 不可用或调用失败时回退到纯 JS 实现 */
const computeHmac = async (secret: string, message: string): Promise<Uint8Array> => {
  const messageBytes = textEncoder.encode(message);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const key = await crypto.subtle.importKey(
        'raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      return new Uint8Array(await crypto.subtle.sign('HMAC', key, messageBytes));
    } catch {
      /* 降级到纯 JS 实现 */
    }
  }
  return hmacSha256Fallback(textEncoder.encode(secret), messageBytes);
};

/** 生成 HS256 签名 Token */
export const signJwt = async (payload: Record<string, unknown>, secret: string): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const head = encodeText(JSON.stringify(header));
  const body = encodeText(JSON.stringify(payload));
  const signature = await computeHmac(secret, `${head}.${body}`);
  return `${head}.${body}.${bytesToBase64Url(signature)}`;
};

/** 校验 HS256 签名，结构异常或签名不匹配返回 false */
export const verifyJwt = async (token: string, secret: string): Promise<boolean> => {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  try {
    const expected = await computeHmac(secret, `${parts[0]}.${parts[1]}`);
    const actual = base64UrlToBytes(parts[2]);
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    return diff === 0;
  } catch {
    return false;
  }
};

/** 解出 header / payload，不验签 */
export const decodeJwt = (token: string): DecodedJwt => {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('Token 结构非法，应为 header.payload.signature 三段');
  try {
    return {
      header: JSON.parse(decodeText(parts[0])) as Record<string, unknown>,
      payload: JSON.parse(decodeText(parts[1])) as Record<string, unknown>,
      signature: parts[2]
    };
  } catch {
    throw new Error('Token 内容无法解析，请检查是否为合法 JWT');
  }
};

/** exp 是否已过期（无 exp 字段视为未过期） */
export const isExpired = (payload: Record<string, unknown>): boolean => {
  const exp = payload.exp;
  if (typeof exp !== 'number') return false;
  return exp * 1000 <= Date.now();
};

/** 生成随机密钥（十六进制，32 位） */
export const randomSecret = (): string => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};
