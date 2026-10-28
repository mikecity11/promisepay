import test from 'node:test';
import assert from 'node:assert/strict';
import {RHEA,USDC,internalAmount,suppliedAmount,supplyConfirmed,withdrawalConfirmed,aprLabel} from '../src/rhea.js';
test('RHEA precision preserves micro-USDC and floors only sub-micro interest',()=>{
 assert.equal(internalAmount('50000',12),'50000000000000000');
 assert.equal(suppliedAmount({supplied:[{token_id:USDC,balance:'50000000000000999'}]},USDC,12),'50000');
 assert.equal(suppliedAmount(null,USDC,12),'0');
 assert.throws(()=>internalAmount('0',12));
 assert.equal(aprLabel('0.0000022283666'),'0.000223%');
});
test('refunded and partial supplies are not full deposit successes',()=>{
 const receipt=value=>({status:{SuccessValue:btoa(JSON.stringify(value))}});
 assert.equal(supplyConfirmed(receipt('50000'),'50000'),true);
 assert.equal(supplyConfirmed(receipt('0'),'50000'),false);
 assert.equal(supplyConfirmed(receipt('49999'),'50000'),false);
 assert.equal(supplyConfirmed({status:{SuccessValue:''}},'50000'),false);
});
test('RHEA withdrawal requires exact transfer proof from the expected token and sender',()=>{
 const receipt={receipts_outcome:[{outcome:{executor_id:USDC,logs:['EVENT_JSON:'+JSON.stringify({standard:'nep141',event:'ft_transfer',data:[{old_owner_id:RHEA,new_owner_id:'owner.testnet',amount:'50000'}]})]}}]};
 assert.equal(withdrawalConfirmed(receipt,'owner.testnet','50000'),true);
 assert.equal(withdrawalConfirmed(receipt,'other.testnet','50000'),false);
 assert.equal(withdrawalConfirmed(receipt,'owner.testnet','50001'),false);
 receipt.receipts_outcome[0].outcome.executor_id='fake.testnet';
 assert.equal(withdrawalConfirmed(receipt,'owner.testnet','50000'),false);
});
