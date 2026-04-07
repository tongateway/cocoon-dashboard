export function nanoToTon(nano) {
  return parseInt(nano) / 1e9;
}

export function formatTon(nano) {
  const ton = nanoToTon(nano);
  if (ton >= 1_000_000) return (ton / 1_000_000).toFixed(2) + 'M';
  if (ton >= 1_000) return (ton / 1_000).toFixed(2) + 'K';
  if (ton >= 1) return ton.toFixed(2);
  return ton.toFixed(4);
}

export function truncateAddress(address) {
  if (!address || address.length < 12) return address || '';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function timeAgo(unixTimestamp) {
  const seconds = Math.floor(Date.now() / 1000) - unixTimestamp;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function classifyTransaction(tx) {
  const inSource = tx.in_msg?.source || '';
  const inValue = parseInt(tx.in_msg?.value || '0');
  const outMsgs = tx.out_msgs || [];
  const hasBounce = outMsgs.some(m => m.destination === inSource && parseInt(m.value) > 0);

  if (hasBounce) return 'bounce';
  if (outMsgs.length > 0 && inValue === 0) return 'deployment';
  if (outMsgs.length > 0) return 'payment';
  if (inValue > 0) return 'top-up';
  return 'other';
}
