// Shared executable contract accounting. Persisted values are decimal strings.
const MAX=2n**128n-1n;
export function uint(value){if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('Expected decimal string');const n=BigInt(value);if(n>MAX)throw Error('Amount overflow');return n;}
export function distribute(received,commitments,paid,bps){
 const incoming=uint(received);if(incoming===0n)throw Error('Empty payment');
 if(!Number.isInteger(bps)||bps<0||bps>10000)throw Error('Invalid savings rate');
 const left=commitments.map((c,i)=>{const target=uint(c.amount), prior=uint(paid[i]);if(prior>target)throw Error('Invalid previous allocation');return target-prior;});
 const total=left.reduce((s,n)=>s+n,0n);if(total>MAX)throw Error('Commitments overflow');
 const funded=incoming<total?incoming:total;
 const shares=left.map((n,i)=>({i,n:total?funded*n/total:0n,r:total?funded*n%total:0n}));
 let dust=funded-shares.reduce((s,x)=>s+x.n,0n);
 const ranked=[...shares].sort((a,b)=>a.r>b.r?-1:a.r<b.r?1:a.i-b.i);
 for(const s of ranked)if(dust>0n){s.n++;dust--;}
 const own=incoming-funded,savings=own*BigInt(bps)/10000n;
 return {shares:shares.map(x=>x.n.toString()),savings:savings.toString(),available:(own-savings).toString()};
}
