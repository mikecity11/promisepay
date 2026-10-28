// RHEA's public testnet deployment; never reuse this registry on mainnet.
export const RHEA = 'contract.1689937928.burrow.testnet';
export const USDC = '3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af';
export function internalAmount(amount, extra) {
  if(!/^\d+$/.test(amount)||BigInt(amount)<=0n||!Number.isInteger(extra)||extra<0||extra>24)throw Error('Invalid RHEA amount or precision.');
  return (BigInt(amount)*10n**BigInt(extra)).toString();
}
export function suppliedAmount(account, token, extra) {
  const items=account?.supplied || [];
  const position=items.find(item=>item.token_id===token);
  return (BigInt(position?.balance||'0')/10n**BigInt(extra)).toString();
}
export function supplyConfirmed(result,amount) {
  try {return BigInt(JSON.parse(atob(result.status.SuccessValue)))===BigInt(amount);}catch{return false;}
}
export function withdrawalConfirmed(result,account,amount) {
  return (result.receipts_outcome||[]).some(receipt=>receipt.outcome.executor_id===USDC&&(receipt.outcome.logs||[]).some(log=>{
    try {const event=JSON.parse(log.replace(/^EVENT_JSON:/,''));return event.standard==='nep141'&&event.event==='ft_transfer'&&event.data.some(d=>d.old_owner_id===RHEA&&d.new_owner_id===account&&BigInt(d.amount)===BigInt(amount));}catch{return false;}
  }));
}
export function aprLabel(apr) {
  const rate=Number(apr)*100;
  if(!Number.isFinite(rate)||rate<0)throw Error('Rate unavailable.');
  return `${rate.toLocaleString(undefined,{maximumFractionDigits:rate<0.01?6:2})}%`;
}
