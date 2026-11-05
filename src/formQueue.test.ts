import { describe, expect, it } from 'vitest';
import {
  FORM_QUEUE_KEY, clearSynced, createQueueId, enqueue, markFailed, markRetry,
  markSynced, pendingCount, readQueue, removeEntry, writeQueue, type FormPayload, type QueueEntry
} from './formQueue';

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

const payload = (overrides: Partial<FormPayload> = {}): FormPayload => ({
  name: '张工',
  employeeId: 'E1024',
  dept: 'FAB 良率工程部',
  lotId: 'LOT-20261105-A',
  category: '良率异常',
  description: '测试描述',
  ...overrides
});

const entry = (overrides: Partial<QueueEntry> = {}): QueueEntry => ({
  id: 'q1',
  payload: payload(),
  createdAt: 1700000000000,
  status: 'pending',
  attempts: 0,
  ...overrides
});

describe('队列持久化', () => {
  it('无缓存时返回空数组', () => {
    expect(readQueue(createStorage())).toEqual([]);
  });

  it('写入后可完整读回', () => {
    const storage = createStorage();
    const queue = [entry()];
    writeQueue(queue, storage);
    expect(readQueue(storage)).toEqual(queue);
    expect(storage.getItem(FORM_QUEUE_KEY)).toContain('LOT-20261105-A');
  });

  it('JSON 损坏时安全降级为空数组', () => {
    const storage = createStorage();
    storage.setItem(FORM_QUEUE_KEY, 'not-json');
    expect(readQueue(storage)).toEqual([]);
  });

  it('过滤字段非法的记录', () => {
    const storage = createStorage();
    storage.setItem(FORM_QUEUE_KEY, JSON.stringify([
      entry(),
      { id: 'bad', createdAt: 1, attempts: 0, status: 'pending', payload: { name: 1 } },
      { id: 'bad2', createdAt: 1, attempts: 0, status: 'unknown', payload: payload() }
    ]));
    expect(readQueue(storage)).toHaveLength(1);
  });
});

describe('队列状态流转', () => {
  it('入队后为待同步且尝试次数为 0', () => {
    const queue = enqueue([], payload(), 'q1', 1000);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].attempts).toBe(0);
    expect(queue[0].createdAt).toBe(1000);
  });

  it('标记成功后状态变为已提交', () => {
    const queue = markSynced([entry()], 'q1');
    expect(queue[0].status).toBe('synced');
    expect(queue[0].error).toBeUndefined();
  });

  it('标记失败后累加尝试次数并记录原因', () => {
    const queue = markFailed([entry()], 'q1', 'HTTP 500');
    expect(queue[0].status).toBe('failed');
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].error).toBe('HTTP 500');
  });

  it('重试会重置为待同步并清除错误', () => {
    const failed = markFailed([entry()], 'q1', '超时');
    const retried = markRetry(failed, 'q1');
    expect(retried[0].status).toBe('pending');
    expect(retried[0].error).toBeUndefined();
    expect(retried[0].attempts).toBe(1);
  });
});

describe('队列辅助操作', () => {
  it('删除指定记录', () => {
    expect(removeEntry([entry(), entry({ id: 'q2' })], 'q1')).toHaveLength(1);
  });

  it('清除已提交记录，保留待同步与失败记录', () => {
    const queue = [
      entry({ id: 'a', status: 'synced' }),
      entry({ id: 'b', status: 'pending' }),
      entry({ id: 'c', status: 'failed' })
    ];
    expect(clearSynced(queue).map(item => item.id)).toEqual(['b', 'c']);
  });

  it('待同步数量包含待同步与失败', () => {
    const queue = [
      entry({ id: 'a', status: 'synced' }),
      entry({ id: 'b', status: 'pending' }),
      entry({ id: 'c', status: 'failed' })
    ];
    expect(pendingCount(queue)).toBe(2);
  });

  it('生成唯一的队列 ID', () => {
    const ids = new Set([createQueueId(), createQueueId(), createQueueId()]);
    expect(ids.size).toBe(3);
  });
});
