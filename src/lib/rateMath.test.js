import { describe, it, expect } from 'vitest';
import { computeSpend } from './rateMath';

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
