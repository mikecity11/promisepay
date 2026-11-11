import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import * as experience from '../src/experience.js';
import * as network from '../src/network.js';
import * as rhea from '../src/rhea.js';

const plans=[{id:'0',title:'Independent income',owner:'owner.testnet',commitments:[],accepted:[],paid:[],savings_bps:500},{id:'1',title:'Video project',owner:'owner.testnet',commitments:[{account_id:'teammate.testnet',amount:'1000000'}],accepted:[],paid:['0'],savings_bps:500}];
async function workspace(account='owner.testnet',lending=false) {
  const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://workspace.example/#dashboard',runScripts:'outside-only'});
  const w=dom.window;let listener,marketFailures=0;const requests=[];
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.scrollTo=()=>{};
  w.setInterval=()=>0;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  const wallet={
    initWallet:async(_,cb)=>{listener=cb;cb(account);},connect:async()=>{},disconnect:async()=>{account='';listener('');},currentAccount:()=>account,
    getConfig:()=>({contractId:'contract.testnet',tokenId:lending?rhea.USDC:'usdc.testnet',explorer:'https://testnet.nearblocks.io'}),
    view:async(method,args)=>method==='get_agreement'?structuredClone(plans[Number(args.id)]||null):{available:'950000',savings:'50000'},
    tokenView:async(method)=>{
      if(lending==='retry'&&method==='get_asset'&&marketFailures++===0)throw Error('NEAR RPC 429');
      if(lending==='new'&&(method==='get_account'||method==='storage_balance_of'))return null;
      if(lending&&method==='get_asset')return {token_id:rhea.USDC,config:{extra_decimals:12,can_deposit:true,can_withdraw:true},supply_apr:'0.0000022283666'};
      if(lending&&method==='get_account')return {supplied:[{token_id:rhea.USDC,balance:'1000000000000000000'}]};
      return {total:'1250000000000000000000',available:'0'};
    },
    transact:async(...args)=>{requests.push(args);return {transaction:{hash:'mock-hash',signer_id:account},status:{SuccessValue:'IjIi'},receipts_outcome:[]};},
    fund:async(...args)=>{requests.push(args);return {transaction:{hash:'mock-hash',signer_id:account}};},send:async()=>{},finalize:async r=>r,
  };
  const context=dom.getInternalVMContext();
  const synthetic=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
  const modules={ './polyfills.js':synthetic({}),'./wallet.js':synthetic(wallet),'./network.js':synthetic(network),'./experience.js':synthetic(experience),'./rhea.js':synthetic(rhea) };
  const app=new vm.SourceTextModule(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),{context});
  await app.link(specifier=>modules[specifier]);await app.evaluate();
  const settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
  await settle();
  return {w,doc:w.document,requests,settle,close:()=>w.close()};
}
test('workspace loads human-readable balances and finds plans by name without ID entry',async()=>{
  const app=await workspace();try {
    assert.equal(app.doc.querySelector('[data-balance=available]').textContent,'0.95');
    assert.equal(app.doc.querySelector('[data-balance=savings]').textContent,'0.05');
    assert.match(app.doc.getElementById('plansList').textContent,/Independent income/);
    assert.match(app.doc.getElementById('plansList').textContent,/Video project/);
    assert.equal(app.doc.getElementById('agreementId'),null);
    assert.equal(app.doc.getElementById('chainCommitments'),null);
    assert.equal(app.doc.getElementById('connect').textContent,'Disconnect wallet');
  }finally{app.close();}
});
test('teammate sees an invitation with a normal amount and a direct review action',async()=>{
  const app=await workspace('teammate.testnet');try{
    const invite=app.doc.getElementById('planInvitations');assert.match(invite.textContent,/Video project/);assert.match(invite.textContent,/1.00 USDC/);
    invite.querySelector('button').click();assert.equal(app.doc.getElementById('detailDialog').open,true);
    assert.match(app.doc.getElementById('detailContent').textContent,/Review & accept plan/);
    assert.doesNotMatch(app.doc.getElementById('detailContent').textContent,/Add a payment/);
  }finally{app.close();}
});
test('new plan uses named fields, shows a fee review, and makes no request before confirmation',async()=>{
  const app=await workspace();try{
    app.doc.querySelector('[data-create]').click();app.doc.getElementById('planName').value='My next chapter';
    app.doc.getElementById('planForm').dispatchEvent(new app.w.Event('submit',{cancelable:true,bubbles:true}));
    assert.equal(app.doc.getElementById('reviewDialog').open,true);assert.match(app.doc.getElementById('reviewContent').textContent,/0.1 test NEAR/);
    assert.equal(app.requests.length,0);app.doc.getElementById('confirmAction').click();await app.settle();
    assert.equal(app.requests[0][0],'create_agreement');assert.equal(app.requests[0][1].title,'My next chapter');
    assert.equal(app.requests[0][1].savings_bps,500);assert.equal(app.doc.getElementById('progressTitle').textContent,'Your plan is ready.');
  }finally{app.close();}
});
test('withdraw all fills 0.05 rather than base units and the review identifies the destination',async()=>{
  const app=await workspace();try{
    app.doc.querySelector('[data-withdraw=savings]').click();app.doc.getElementById('withdrawAll').click();
    assert.equal(app.doc.getElementById('withdrawAmount').value,'0.05');
    app.doc.getElementById('withdrawForm').dispatchEvent(new app.w.Event('submit',{cancelable:true,bubbles:true}));
    assert.match(app.doc.getElementById('reviewContent').textContent,/0.05 USDC/);assert.match(app.doc.getElementById('reviewContent').textContent,/owner.testnet/);assert.equal(app.requests.length,0);
  }finally{app.close();}
});
test('disconnect clears displayed balances and prevents stale wallet plans from staying visible',async()=>{
  const app=await workspace();try{
    app.doc.getElementById('connect').click();await app.settle();assert.equal(app.doc.querySelector('[data-balance=available]').textContent,'—');
    assert.doesNotMatch(app.doc.getElementById('plansList').textContent,/Independent income/);
    assert.equal(app.doc.getElementById('connectionPrompt').hidden,false);
  }finally{app.close();}
});
test('payment uses normal USDC input and reviews the savings split before wallet submission',async()=>{
  const app=await workspace();try{
    const card=[...app.doc.querySelectorAll('#plansList .plan-card')].find(c=>c.textContent.includes('Independent income'));
    card.querySelector('button').click();app.doc.querySelector('#detailContent .plan-actions button').click();
    app.doc.getElementById('paymentAmount').value='1';app.doc.getElementById('paymentAmount').dispatchEvent(new app.w.Event('input'));
    assert.match(app.doc.getElementById('paymentPreview').textContent,/0.05 USDC/);
    app.doc.getElementById('paymentForm').dispatchEvent(new app.w.Event('submit',{cancelable:true,bubbles:true}));
    assert.match(app.doc.getElementById('reviewContent').textContent,/1.00 USDC/);assert.match(app.doc.getElementById('reviewContent').textContent,/0.95 USDC/);
    assert.equal(app.requests.length,0);
  }finally{app.close();}
});

test('RHEA shows separate live lending balance and reviews the first step without sending funds',async()=>{
  const app=await workspace('owner.testnet',true);try{
    assert.equal(app.doc.getElementById('rheaBalance').textContent,'1.00 USDC');
    assert.match(app.doc.getElementById('rheaRate').textContent,/0.000223%/);
    app.doc.getElementById('earnStart').click();await app.settle();
    assert.equal(app.doc.getElementById('earnDialog').open,true);
    assert.equal(app.doc.getElementById('earnAmount').value,'0.05');
    app.doc.getElementById('earnForm').dispatchEvent(new app.w.Event('submit',{cancelable:true,bubbles:true}));await app.settle();
    assert.match(app.doc.getElementById('reviewContent').textContent,/does not start earning/);
    assert.equal(app.requests.length,0);
  }finally{app.close();}
});
test('RHEA is disabled for an unverified token configuration',async()=>{
  const app=await workspace();try{assert.equal(app.doc.getElementById('earnStart').disabled,true);assert.equal(app.doc.getElementById('earnWithdraw').disabled,true);}finally{app.close();}
});

test('new RHEA account displays zero and offers registration rather than failing',async()=>{
 const app=await workspace('owner.testnet','new');try{
  assert.equal(app.doc.getElementById('rheaBalance').textContent,'0.00 USDC');
  assert.equal(app.doc.getElementById('earnStart').disabled,false);
  assert.equal(app.doc.getElementById('rheaRetry').hidden,true);
 }finally{app.close();}
});
test('failed market read stays disabled and user can retry without a wallet request',async()=>{
 const app=await workspace('owner.testnet','retry');try{
  assert.equal(app.doc.getElementById('earnStart').disabled,true);
  assert.match(app.doc.getElementById('rheaError').textContent,/market: NEAR RPC 429/);
  assert.equal(app.doc.getElementById('rheaRetry').hidden,false);
  app.doc.getElementById('rheaRetry').click();await app.settle();
  assert.equal(app.doc.getElementById('rheaRetry').hidden,true);
  assert.equal(app.doc.getElementById('earnStart').disabled,false);
  assert.equal(app.requests.length,0);
 }finally{app.close();}
});
