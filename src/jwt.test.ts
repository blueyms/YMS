import { describe, expect, it, vi } from 'vitest';
import { hmacSha256Fallback } from './sha256';
import { decodeJwt, decodeText, encodeText, isExpired, randomSecret, signJwt, verifyJwt } from './jwt';

const buildToken = (payload: Record<string, unknown>) =>
  `${encodeText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encodeText(JSON.stringify(payload))}.sig`;

describe('jwt base64url', () => {
  it('中文与特殊字符可无损往返编码', () => {
    const text = 'YMS 良率管理系统 +/=-';
    expect(decodeText(encodeText(text))).toBe(text);
  });

  it('编码结果不含 + / = 字符', () => {
    const encoded = encodeText('>>>???///+++');
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe('decodeJwt', () => {
  it('正确解析 header 与 payload', () => {
    const decoded = decodeJwt(buildToken({ sub: 'demo', role: 'YIELD_ENGINEER' }));
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload.sub).toBe('demo');
    expect(decoded.signature).toBe('sig');
  });

  it('结构非法时抛出错误', () => {
    expect(() => decodeJwt('not-a-jwt')).toThrow('Token 结构非法');
  });

  it('内容非法时抛出错误', () => {
    expect(() => decodeJwt('@@@.###.sig')).toThrow('Token 内容无法解析');
  });
});

describe('isExpired', () => {
  it('过去时间为已过期', () => {
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) - 10 })).toBe(true);
  });

  it('未来时间未过期', () => {
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) + 60 })).toBe(false);
  });

  it('缺少 exp 视为未过期', () => {
    expect(isExpired({})).toBe(false);
  });
});

describe('signJwt / verifyJwt', () => {
  it('签名后可通过相同密钥验签', async () => {
    const token = await signJwt({ sub: 'demo' }, 'secret-1');
    expect(await verifyJwt(token, 'secret-1')).toBe(true);
  });

  it('不同密钥验签失败', async () => {
    const token = await signJwt({ sub: 'demo' }, 'secret-1');
    expect(await verifyJwt(token, 'secret-2')).toBe(false);
  });

  it('篡改载荷后验签失败', async () => {
    const token = await signJwt({ sub: 'demo' }, 'secret-1');
    const [head, , sig] = token.split('.');
    const forged = `${head}.${encodeText(JSON.stringify({ sub: 'admin' }))}.${sig}`;
    expect(await verifyJwt(forged, 'secret-1')).toBe(false);
  });

  it('结构非法直接返回 false', async () => {
    expect(await verifyJwt('a.b', 'secret')).toBe(false);
  });
});

describe('randomSecret', () => {
  it('生成 32 位十六进制密钥', () => {
    expect(randomSecret()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('HMAC-SHA256 纯 JS 降级实现', () => {
  it('无 Web Crypto 时仍可签名与验签', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });
    try {
      const token = await signJwt({ sub: 'demo' }, 'secret-1');
      expect(token.split('.')).toHaveLength(3);
      expect(await verifyJwt(token, 'secret-1')).toBe(true);
      expect(await verifyJwt(token, 'secret-2')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('通过 RFC 4231 测试向量 1', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const message = new TextEncoder().encode('Hi There');
    const digest = hmacSha256Fallback(key, message);
    const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('长密钥自动先做 SHA-256 归一化', () => {
    const key = new Uint8Array(80).fill(0xaa);
    expect(hmacSha256Fallback(key, new Uint8Array([1, 2, 3])).length).toBe(32);
  });
});
