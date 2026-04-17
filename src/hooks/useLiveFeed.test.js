import { describe, it, expect } from 'vitest';
import { __makeBuffer } from './useLiveFeed';

describe('rolling buffer', () => {
  it('pushes items and keeps newest first', () => {
    const buf = __makeBuffer(5);
    buf.push({ id: 'a', utime: 1 });
    buf.push({ id: 'b', utime: 2 });
    expect(buf.items().map(x => x.id)).toEqual(['b', 'a']);
  });

  it('caps at capacity, dropping oldest', () => {
    const buf = __makeBuffer(3);
    for (let i = 0; i < 5; i++) buf.push({ id: String(i), utime: i });
    expect(buf.items().map(x => x.id)).toEqual(['4', '3', '2']);
  });

  it('deduplicates by id', () => {
    const buf = __makeBuffer(5);
    buf.push({ id: 'a', utime: 1 });
    buf.push({ id: 'a', utime: 1 });
    expect(buf.items()).toHaveLength(1);
  });

  it('filters txsInWindow by utime', () => {
    const buf = __makeBuffer(10);
    const now = 1_700_000_000;
    buf.push({ id: 'old', utime: now - 7200 });
    buf.push({ id: 'new', utime: now - 10 });
    const recent = buf.txsInWindow(60 * 60 * 1000, now * 1000);
    expect(recent.map(x => x.id)).toEqual(['new']);
  });
});
