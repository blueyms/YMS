/** JWT 密钥管理：本地密钥条目的读写、增改删与脱敏展示（仅使用浏览器 localStorage） */

export interface KeyItem {
  id: string;
  name: string;
  secret: string;
  createdAt: number;
}

export const KEY_STORAGE = 'yms-jwt-keys';

const isKeyItem = (value: unknown): value is KeyItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.secret === 'string'
    && typeof item.createdAt === 'number';
};

export const readKeys = (storage: Storage): KeyItem[] => {
  try {
    const raw = storage.getItem(KEY_STORAGE);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isKeyItem);
  } catch {
    return [];
  }
};

export const writeKeys = (keys: KeyItem[], storage: Storage): void => {
  storage.setItem(KEY_STORAGE, JSON.stringify(keys));
};

/** 同名密钥覆盖更新，否则追加 */
export const upsertKey = (keys: KeyItem[], item: KeyItem): KeyItem[] => {
  const index = keys.findIndex(k => k.id === item.id);
  if (index === -1) return [...keys, item];
  const next = [...keys];
  next[index] = item;
  return next;
};

export const removeKey = (keys: KeyItem[], id: string): KeyItem[] => keys.filter(k => k.id !== id);

/** 密钥脱敏：保留前 6 位 */
export const maskSecret = (secret: string): string => {
  if (secret.length <= 6) return secret;
  return `${secret.slice(0, 6)}••••`;
};

/** 生成密钥条目 ID，优先使用 crypto.randomUUID */
export const createKeyId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};
