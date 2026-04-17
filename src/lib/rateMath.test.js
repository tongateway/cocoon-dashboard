import { describe, it, expect } from 'vitest';
import { computeSpend, workerRevenue, commission, tokensProcessed, activeWorkers, activeClients, inWindow, networkHealth } from './rateMath';

function tx({ role, opName, inValue = 0 }) {
  return {
    contractRole: role,
    in_msg: { value: String(inValue), msg_data: { body: '' } },
    out_msgs: [],
    _op: opName,
  };
}

describe('computeSpend', () => {
  it('returns 0 for empty array', () => {
    expect(computeSpend([])).toBe(0);
  });

  it('sums client_proxy_request in-values on proxy contracts (nanoTON)', () => {
    const txs = [
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 100_000_000 }),
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 200_000_000 }),
    ];
    expect(computeSpend(txs)).toBe(300_000_000);
  });

  it('sums ext_client_charge_signed in-values on client contracts', () => {
    const txs = [
      tx({ role: 'cocoon_client', opName: 'ext_client_charge_signed', inValue: 50_000_000 }),
    ];
    expect(computeSpend(txs)).toBe(50_000_000);
  });

  it('ignores txs with other ops or roles', () => {
    const txs = [
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 999 }),
      tx({ role: 'cocoon_proxy', opName: 'excesses', inValue: 999 }),
    ];
    expect(computeSpend(txs)).toBe(0);
  });
});

describe('workerRevenue', () => {
  it('sums ext_worker_payout_signed on worker contracts', () => {
    const txs = [
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 400_000_000 }),
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 100_000_000 }),
      tx({ role: 'cocoon_client', opName: 'ext_worker_payout_signed', inValue: 999 }), // wrong role
    ];
    expect(workerRevenue(txs)).toBe(500_000_000);
  });
});

describe('commission', () => {
  it('is compute spend minus worker revenue', () => {
    const txs = [
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 1_000_000_000 }),
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 900_000_000 }),
    ];
    expect(commission(txs)).toBe(100_000_000);
  });

  it('clamps negative to 0', () => {
    const txs = [tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 500 })];
    expect(commission(txs)).toBe(0);
  });
});

describe('tokensProcessed', () => {
  it('divides compute spend by pricePerToken', () => {
    const txs = [tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 2000 })];
    expect(tokensProcessed(txs, 20)).toBe(100); // 2000 / 20
  });

  it('uses default 20 nanoTON if pricePerToken missing', () => {
    const txs = [tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 200 })];
    expect(tokensProcessed(txs)).toBe(10);
  });
});

describe('inWindow', () => {
  it('filters txs within N ms of now', () => {
    const now = 1_700_000_000;
    const txs = [
      { utime: now - 10 },       // 10s ago — include
      { utime: now - 3700 },     // 61min ago — exclude for 1h window
      { utime: now - 60 * 60 + 5 }, // 59m55s ago — include for 1h
    ];
    const r = inWindow(txs, 60 * 60 * 1000, now * 1000);
    expect(r.map(t => t.utime)).toEqual([now - 10, now - 60 * 60 + 5]);
  });
});

describe('activeWorkers', () => {
  it('counts unique worker addresses with ext_worker_payout_signed', () => {
    const txs = [
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA1' }, in_msg: { value: '100', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA1' }, in_msg: { value: '200', msg_data: {} }, out_msgs: [] }, // dup
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA2' }, in_msg: { value: '300', msg_data: {} }, out_msgs: [] },
    ];
    expect(activeWorkers(txs)).toBe(2);
  });
});

describe('activeClients', () => {
  it('counts unique client addresses with charge ops', () => {
    const txs = [
      { contractRole: 'cocoon_proxy', _op: 'client_proxy_request',
        in_msg: { source: 'EQC1', value: '100', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_client', _op: 'ext_client_charge_signed',
        address: { account_address: 'EQC2' }, in_msg: { value: '50', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_proxy', _op: 'client_proxy_request',
        in_msg: { source: 'EQC1', value: '100', msg_data: {} }, out_msgs: [] }, // dup
    ];
    expect(activeClients(txs)).toBe(2);
  });
});

describe('networkHealth', () => {
  const now = 1_700_000_000;
  const t = (ago) => ({ utime: now - ago }); // ago is in seconds

  it('returns dormant for empty buffer', () => {
    const h = networkHealth([], now * 1000);
    expect(h.status).toBe('dormant');
    expect(h.last1hCount).toBe(0);
    expect(h.lastTxAgoSec).toBeNull();
  });

  it('returns healthy when recent activity + sustained burst', () => {
    const txs = [];
    for (let i = 0; i < 12; i++) txs.push(t(i * 60));  // 12 txs over 12 minutes, incl last 5min
    const h = networkHealth(txs, now * 1000);
    expect(h.status).toBe('healthy');
    expect(h.last1hCount).toBe(12);
    expect(h.lastTxAgoSec).toBe(0);
  });

  it('returns quiet when activity only beyond 5min but within 1h', () => {
    const txs = [t(400), t(500), t(1200)]; // all between ~6min and 20min ago
    const h = networkHealth(txs, now * 1000);
    expect(h.status).toBe('quiet');
    expect(h.last1hCount).toBe(3);
  });

  it('returns stalled when activity only beyond 1h but within 24h', () => {
    const txs = [t(7200), t(10_000)]; // 2h and ~2.8h ago
    const h = networkHealth(txs, now * 1000);
    expect(h.status).toBe('stalled');
    expect(h.last24hCount).toBe(2);
    expect(h.last1hCount).toBe(0);
  });

  it('reports lastOlderActivityAgoSec for txs >24h old', () => {
    const txs = [t(60), t(8 * 86400), t(9 * 86400)]; // one recent, two ~8-9 days ago
    const h = networkHealth(txs, now * 1000);
    expect(h.status).toBe('quiet'); // 1 tx in last hour, none in last 5min
    expect(h.lastOlderActivityAgoSec).toBe(8 * 86400);
  });
});
