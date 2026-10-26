import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allocate,savingTopUp} from '../src/allocate.js';
const commitments=[{id:'editor',amount:20000},{id:'designer',amount:10000}];
test('team entitlements precede personal savings',()=>assert.deepEqual(allocate({received:60000,commitments,paid:{}}),{payouts:[{id:'editor',amount:20000},{id:'designer',amount:10000}],savings:1500,available:28500,outstanding:0}));
test('partial deposits preserve outstanding amounts and resume later',()=>{
const first=allocate({received:15000,commitments,paid:{}});
assert.equal(first.savings,0);assert.equal(first.outstanding,15000);
const next=allocate({received:45000,commitments,paid:Object.fromEntries(first.payouts.map(p=>[p.id,p.amount]))});
assert.equal(next.outstanding,0);assert.equal(next.savings,1500);
});
test('every cent conserved across partial deposits',()=>{
for(let received=1;received<1000;received++){
const r=allocate({received,commitments,paid:{}});
assert.equal(r.payouts.reduce((s,p)=>s+p.amount,0)+r.savings+r.available,received);
}
});
test('personal mode saves without team commitments',()=>assert.equal(allocate({received:10000,commitments:[],paid:{},savingsBps:1000}).savings,1000));
test('top up preserves recipient payment',()=>assert.deepEqual(savingTopUp(10000,500),{recipient:10000,savings:500,total:10500}));
test('invalid inputs cannot create money',()=>{for(const received of [-1,0,NaN,1.5,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>allocate({received,commitments,paid:{}}));assert.throws(()=>allocate({received:100,commitments:[...commitments,commitments[0]],paid:{}}));});
