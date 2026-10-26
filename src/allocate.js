// All amounts are integer minor units. No floating-point financial arithmetic.
export function allocate({received, commitments, paid, savingsBps = 500, pauseSavings = true}) {
  if (![received,savingsBps].every(Number.isSafeInteger) || received <= 0 || savingsBps < 0 || savingsBps > 10000) throw Error('Invalid amount or savings percentage');
  const ids = commitments.map(c=>c.id);
  if (new Set(ids).size !== ids.length) throw Error('Duplicate recipient');
  const outstanding = commitments.map(c=>{
    const previous = paid[c.id] ?? 0;
    if (!Number.isSafeInteger(c.amount) || c.amount < 0 || !Number.isSafeInteger(previous) || previous < 0 || previous > c.amount) throw Error('Invalid commitment');
    return {id:c.id, amount:c.amount-previous};
  });
  const total = outstanding.reduce((s,c)=>s+BigInt(c.amount),0n);
  const funding = BigInt(received) < total ? BigInt(received) : total;
  const shares = outstanding.map(c=>({id:c.id, amount:total ? funding*BigInt(c.amount)/total : 0n, remainder:total ? funding*BigInt(c.amount)%total : 0n}));
  let dust = funding-shares.reduce((s,c)=>s+c.amount,0n);
  // Largest remainder; stable recipient order breaks ties deterministically.
  const ranked = [...shares].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:0);
  for (const c of ranked) if (dust>0n) {c.amount++;dust--;}
  const ownShare = BigInt(received)-funding;
  const savings = pauseSavings && funding<total ? 0n : ownShare*BigInt(savingsBps)/10000n;
  return {payouts:shares.map(c=>({id:c.id,amount:Number(c.amount)})), savings:Number(savings), available:Number(ownShare-savings), outstanding:Number(total-funding)};
}
export function savingTopUp(amount,bps) {
  if (!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(bps)||bps<0||bps>10000) throw Error('Invalid transfer');
  const savings = Number(BigInt(amount)*BigInt(bps)/10000n);
  if (!Number.isSafeInteger(amount+savings)) throw Error('Transfer too large');
  return {recipient:amount,savings,total:amount+savings};
}
