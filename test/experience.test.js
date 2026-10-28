import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnits } from '../src/network.js';
import { formatAmount, editableAmount, savingsBps, buildCommitments, allocationPreview, planReady, transactionFailure, transactionEvents } from '../src/experience.js';

test('normal USDC amounts round trip exactly, including cents and large balances', () => {
  for (const value of ['1','0.10','0.000001','19000000000000.123456']) {
    const units = parseUnits(value,6);
    assert.equal(parseUnits(editableAmount(units),6),units);
  }
  assert.equal(formatAmount('1000000'),'1.00');
  assert.equal(formatAmount('950000'),'0.95');
  assert.equal(formatAmount('1'),'0.000001');
  assert.equal(formatAmount('0'),'0.00');
});
test('teammate form maps human amounts to the contract and rejects accidental self or duplicate payments', () => {
  const row={account:'hacken001.testnet',amount:'1'};
  assert.deepEqual(buildCommitments([row],'mikecity.testnet'),[{account_id:'hacken001.testnet',amount:'1000000'}]);
  assert.throws(()=>buildCommitments([row,row],'mikecity.testnet'),/once/);
  assert.throws(()=>buildCommitments([row],'hacken001.testnet'),/own share/);
  assert.throws(()=>buildCommitments([{...row,amount:'1.0000001'}],'mikecity.testnet'));
});
test('payment review covers team obligations before saving from the remainder', () => {
  const plan={commitments:[{amount:'1000000'}],paid:['0'],savings_bps:500,accepted:[]};
  assert.deepEqual(allocationPreview('2000000',plan),{team:'1000000',savings:'50000',available:'950000'});
  assert.deepEqual(allocationPreview('500000',plan),{team:'500000',savings:'0',available:'0'});
  assert.deepEqual(allocationPreview('1000000',{...plan,paid:['1000000']}),{team:'0',savings:'50000',available:'950000'});
  assert.equal(savingsBps('5.25'),525);
  assert.equal(savingsBps('0'),0);
  assert.throws(()=>savingsBps('100.01'));
  assert.throws(()=>savingsBps('0.001'));
});
test('all participants must accept before payment is offered', () => {
  const p={commitments:[{account_id:'one.testnet'},{account_id:'two.testnet'}],accepted:['one.testnet']};
  assert.equal(planReady(p),false);
  assert.equal(planReady({...p,accepted:['one.testnet','two.testnet']}),true);
  assert.equal(planReady({commitments:[],accepted:[]}),true);
});
test('receipt failure and refunded payment cannot be mistaken for allocation success', () => {
  const failed={status:{SuccessValue:''},receipts_outcome:[{outcome:{status:{Failure:{error:'rejected'}},logs:[]}}]};
  assert.match(transactionFailure(failed),/rejected/);
  const refunded={status:{SuccessValue:'IjAi'},receipts_outcome:[{outcome:{status:{SuccessValue:''},logs:['EVENT_JSON:{"event":"ft_transfer"}']}}]};
  assert.equal(transactionEvents(refunded).some(e=>e.event==='allocated'),false);
  const allocated={receipts_outcome:[{outcome:{status:{SuccessValue:''},logs:['{"event":"allocated","agreement_id":"2"}']}}]};
  assert.equal(transactionEvents(allocated)[0].agreement_id,'2');
});
