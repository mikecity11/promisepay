import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedRead,POST} from '../api/near.js';
const query={method:'query',params:{request_type:'call_function',account_id:'contract.1689937928.burrow.testnet',method_name:'get_asset',args_base64:Buffer.from('{}').toString('base64'),finality:'final'}};
test('gateway allows pinned contract reads and rejects signing, other contracts, and arbitrary methods',()=>{
 assert.equal(allowedRead(query).method_name,'get_asset');
 assert.throws(()=>allowedRead({...query,method:'broadcast_tx_commit'}));
 assert.throws(()=>allowedRead({...query,params:{...query.params,account_id:'unknown.testnet'}}));
 assert.throws(()=>allowedRead({...query,params:{...query.params,method_name:'execute'}}));
 assert.throws(()=>allowedRead({...query,params:{...query.params,args_base64:'%%%'}}));
});
test('gateway forwards null read results and upstream errors without inventing balances',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://rpc.testnet.near.org');assert.equal(JSON.parse(options.body).method,'query');return Response.json({result:{result:[110,117,108,108]}});};
  const r=await POST(new Request('https://example.test/api/near',{method:'POST',body:JSON.stringify(query)}));assert.equal(r.status,200);assert.deepEqual((await r.json()).result.result,[110,117,108,108]);
  globalThis.fetch=async()=>new Response('',{status:429});
  assert.equal((await POST(new Request('https://example.test/api/near',{method:'POST',body:JSON.stringify(query)}))).status,429);
 }finally{globalThis.fetch=original;}
});
