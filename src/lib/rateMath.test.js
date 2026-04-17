import { describe, it, expect } from 'vitest';
import { computeSpend, workerRevenue, commission, tokensProcessed, activeWorkers, activeClients, inWindow } from './rateMath';

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
