import test from 'node:test';
import assert from 'node:assert/strict';
import {readRpc} from '../src/rpc.js';
test('read RPC recovers from rate limiting and temporary network errors',async()=>{
 let calls=0;
 const result=await readRpc('https://example.test','query',{}, {pause:async()=>{},fetcher:async()=>{calls++;if(calls===1)return {ok:false,status:429};if(calls===2)throw new TypeError('Failed to fetch');return {ok:true,json:async()=>({result:{result:[110,117,108,108]}})};}});
 assert.equal(calls,3);assert.deepEqual(result.result,[110,117,108,108]);
});
test('deterministic contract failures are never retried',async()=>{
 let calls=0;await assert.rejects(readRpc('https://example.test','query',{}, {pause:async()=>{},fetcher:async()=>{calls++;return {ok:true,json:async()=>({error:{message:'Contract execution error'}})};}}),/Contract execution/);assert.equal(calls,1);
});
