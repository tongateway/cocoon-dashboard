import { describe, it, expect } from 'vitest';
import { classifyTx, TX_TYPE } from './txClassify';

function tx(role, op, { inValue = 0, outValue = 0 } = {}) {
  return {
    contractRole: role,
    _op: op,
    in_msg: { value: String(inValue), msg_data: {} },
    out_msgs: outValue > 0 ? [{ value: String(outValue), msg_data: {} }] : [],
  };
}

describe('classifyTx', () => {
  it('returns WORKER_PAYOUT for ext_worker_payout_signed on worker', () => {
    expect(classifyTx(tx('cocoon_worker', 'ext_worker_payout_signed'))).toBe(TX_TYPE.WORKER_PAYOUT);
  });
  it('returns CLIENT_CHARGE for client_proxy_request on proxy', () => {
    expect(classifyTx(tx('cocoon_proxy', 'client_proxy_request'))).toBe(TX_TYPE.CLIENT_CHARGE);
  });
  it('returns CLIENT_CHARGE for ext_client_charge_signed on client', () => {
    expect(classifyTx(tx('cocoon_client', 'ext_client_charge_signed'))).toBe(TX_TYPE.CLIENT_CHARGE);
  });
  it('returns TOP_UP for client_proxy_top_up or ext_client_top_up', () => {
    expect(classifyTx(tx('cocoon_proxy', 'client_proxy_top_up'))).toBe(TX_TYPE.TOP_UP);
    expect(classifyTx(tx('cocoon_client', 'ext_client_top_up'))).toBe(TX_TYPE.TOP_UP);
  });
  it('returns PROXY_FEE for proxy_save_state or ext_proxy_payout', () => {
    expect(classifyTx(tx('cocoon_proxy', 'ext_proxy_payout'))).toBe(TX_TYPE.PROXY_FEE);
  });
  it('returns OTHER for anything else', () => {
    expect(classifyTx(tx('wallet', null))).toBe(TX_TYPE.OTHER);
    expect(classifyTx(tx('cocoon_wallet', 'excesses'))).toBe(TX_TYPE.OTHER);
  });
});
