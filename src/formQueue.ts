/** 表单离线缓存队列：localStorage 持久化，支持待提交 / 成功 / 失败三态与重试 */

export interface FormPayload {
  name: string;
  employeeId: string;
  dept: string;
  lotId: string;
  category: string;
  description: string;
}

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface QueueEntry {
  id: string;
  payload: FormPayload;
  createdAt: number;
  status: SyncStatus;
  attempts: number;
  error?: string;
}

export const FORM_QUEUE_KEY = 'yms-form-queue';

const isPayload = (value: unknown): value is FormPayload => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === 'string'
    && typeof item.employeeId === 'string'
    && typeof item.dept === 'string'
    && typeof item.lotId === 'string'
    && typeof item.category === 'string'
    && typeof item.description === 'string';
};

const isEntry = (value: unknown): value is QueueEntry => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.createdAt === 'number'
    && typeof item.attempts === 'number'
    && (item.status === 'pending' || item.status === 'synced' || item.status === 'failed')
    && isPayload(item.payload);
};

export const readQueue = (storage: Storage): QueueEntry[] => {
  try {
    const raw = storage.getItem(FORM_QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

export const writeQueue = (queue: QueueEntry[], storage: Storage): void => {
  storage.setItem(FORM_QUEUE_KEY, JSON.stringify(queue));
};

export const enqueue = (queue: QueueEntry[], payload: FormPayload, id: string, createdAt = Date.now()): QueueEntry[] => [
  ...queue,
  { id, payload, createdAt, status: 'pending', attempts: 0 }
];

export const markSynced = (queue: QueueEntry[], id: string): QueueEntry[] =>
  queue.map(item => (item.id === id ? { ...item, status: 'synced', error: undefined } : item));

export const markFailed = (queue: QueueEntry[], id: string, error: string): QueueEntry[] =>
  queue.map(item => (item.id === id
    ? { ...item, status: 'failed', attempts: item.attempts + 1, error }
    : item));

export const markRetry = (queue: QueueEntry[], id: string): QueueEntry[] =>
  queue.map(item => (item.id === id ? { ...item, status: 'pending', error: undefined } : item));

export const removeEntry = (queue: QueueEntry[], id: string): QueueEntry[] =>
  queue.filter(item => item.id !== id);

export const clearSynced = (queue: QueueEntry[]): QueueEntry[] =>
  queue.filter(item => item.status !== 'synced');

export const pendingCount = (queue: QueueEntry[]): number =>
  queue.filter(item => item.status === 'pending' || item.status === 'failed').length;

export const createQueueId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `form-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};
