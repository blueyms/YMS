import { describe, expect, it } from 'vitest';
import { KEY_STORAGE, createKeyId, maskSecret, readKeys, removeKey, upsertKey, writeKeys, type KeyItem } from './keyring';

const createStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); }
  };
};

const sampleKey = (overrides: Partial<KeyItem> = {}): KeyItem => ({
  id: 'k1',
  name: '生产密钥',
  secret: 'secret-1',
  createdAt: 1700000000000,
  ...overrides
});

describe('密钥本地存储', () => {
  it('无数据时返回空数组', () => {
    expect(readKeys(createStorage())).toEqual([]);
  });

  it('写入后可完整读回', () => {
    const storage = createStorage();
    const keys = [sampleKey()];
    writeKeys(keys, storage);
    expect(readKeys(storage)).toEqual(keys);
    expect(storage.getItem(KEY_STORAGE)).toContain('生产密钥');
  });

  it('JSON 损坏时安全返回空数组', () => {
    const storage = createStorage();
    storage.setItem(KEY_STORAGE, '{broken');
    expect(readKeys(storage)).toEqual([]);
  });

  it('非数组或字段非法的条目被过滤', () => {
    const storage = createStorage();
    storage.setItem(KEY_STORAGE, JSON.stringify([
      sampleKey(),
      { id: 'x', name: '缺少 secret' },
      'invalid'
    ]));
    expect(readKeys(storage)).toHaveLength(1);
  });
});

describe('upsertKey / removeKey', () => {
  it('新增密钥追加到末尾', () => {
    const result = upsertKey([sampleKey()], sampleKey({ id: 'k2', name: '测试密钥' }));
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('测试密钥');
  });

  it('相同 id 时原地更新', () => {
    const result = upsertKey([sampleKey()], sampleKey({ secret: 'rotated' }));
    expect(result).toHaveLength(1);
    expect(result[0].secret).toBe('rotated');
  });

  it('删除指定密钥', () => {
    const result = removeKey([sampleKey(), sampleKey({ id: 'k2' })], 'k1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('k2');
  });
});

describe('maskSecret / createKeyId', () => {
  it('长密钥仅保留前 6 位', () => {
    expect(maskSecret('abcdef1234567890')).toBe('abcdef••••');
  });

  it('短密钥原样展示', () => {
    expect(maskSecret('abc')).toBe('abc');
  });

  it('生成非空且唯一的密钥 ID', () => {
    const ids = new Set([createKeyId(), createKeyId(), createKeyId()]);
    expect(ids.size).toBe(3);
    for (const id of ids) expect(id.length).toBeGreaterThan(4);
  });
});
