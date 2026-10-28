import { parseUnits, validAccount } from './network.js';

export function formatAmount(value = '0') {
  const amount = BigInt(value);
  const whole = amount / 1000000n;
  const fraction = (amount % 1000000n).toString().padStart(6, '0');
  return `${whole.toLocaleString('en-US')}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
}
export function editableAmount(value = '0') {
  const [whole, fraction] = formatAmount(value).replaceAll(',', '').split('.');
  return `${whole}.${fraction}`;
}
export function savingsBps(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Enter a savings percentage from 0 to 100, with up to two decimal places.');
  const bps = Math.round(Number(value) * 100);
  if (bps < 0 || bps > 10000) throw Error('Choose a savings percentage from 0 to 100.');
  return bps;
}
export function buildCommitments(rows, owner) {
  if (rows.length > 10) throw Error('You can add up to 10 teammates to a plan.');
  const seen = new Set();
  return rows.map(({ account, amount }) => {
    const account_id = account.trim().toLowerCase();
    if (!validAccount(account_id)) throw Error('Enter a valid NEAR account for each teammate, such as name.testnet.');
    if (account_id === owner) throw Error('Use a teammate’s account. Your own share is calculated automatically.');
    if (seen.has(account_id)) throw Error('Each teammate can only appear once in a plan.');
    seen.add(account_id);
    return { account_id, amount: parseUnits(amount.trim(), 6) };
  });
}
export function allocationPreview(amount, plan) {
  let left = BigInt(amount);
  const remaining = plan.commitments.map((c, i) => BigInt(c.amount) - BigInt(plan.paid[i] || '0'));
  const total = remaining.reduce((a, b) => a + b, 0n);
  const team = left < total ? left : total;
  left -= team;
  const savings = left * BigInt(plan.savings_bps) / 10000n;
  return { team: team.toString(), savings: savings.toString(), available: (left - savings).toString() };
}
export function planReady(plan) {
  return plan.commitments.every(c => plan.accepted.includes(c.account_id));
}
export function transactionFailure(result) {
  const statuses = [result?.status, ...(result?.receipts_outcome || []).map(r => r.outcome.status)];
  const failed = statuses.find(s => s?.Failure);
  return failed ? JSON.stringify(failed.Failure) : null;
}
export function transactionEvents(result) {
  return (result?.receipts_outcome || []).flatMap(r => r.outcome.logs || []).flatMap(log => {
    try { return [JSON.parse(log.replace(/^EVENT_JSON:/, ''))]; } catch { return []; }
  });
}
export function friendlyError(error) {
  const message = error?.message || String(error);
  if (/Invalid token amount/i.test(message)) return 'Enter an amount greater than zero, such as 1 or 0.50 USDC.';
  if (/Too many decimal places/i.test(message)) return 'USDC amounts can have up to six digits after the decimal point.';
  if (/reject|cancel|denied/i.test(message)) return 'You cancelled the wallet request. Nothing new was submitted. You can try again when you’re ready.';
  if (/storage|not registered/i.test(message)) return 'Your wallet needs to be registered for USDC first. Follow the USDC setup step shown here, then try again.';
  if (/Participants must accept/i.test(message)) return 'All teammates need to accept this plan before anyone can add a payment.';
  if (/Insufficient balance|NotEnoughBalance|insufficient funds/i.test(message)) return 'There isn’t enough balance for this request. Check the amount and keep some test NEAR for wallet fees.';
  if (/Already accepted/i.test(message)) return 'You have already accepted this plan. Refresh to see its current status.';
  if (/fetch|network|timeout|RPC|Failed to|429|503|deadline/i.test(message)) return 'We couldn’t confirm the latest information from NEAR. Check your wallet history before retrying a payment, then refresh.';
  return message.length > 220 ? 'The request could not be completed. Open Details for the technical response before trying again.' : message;
}
