// Fixed, read-only testnet gateway. No transaction submission or arbitrary URLs.
const CONTRACT='promisepay-mikecity.testnet';
const TOKEN='3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af';
const RHEA='contract.1689937928.burrow.testnet';
const methods=new Map([
  [CONTRACT,new Set(['get_config','get_agreement','get_balances'])],
  [TOKEN,new Set(['storage_balance_of','storage_balance_bounds','ft_balance_of','ft_metadata'])],
  [RHEA,new Set(['get_asset','get_account','storage_balance_of','storage_balance_bounds'])],
]);
export function allowedRead(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid request.');
  const p=body.params;
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid parameters.');
  if(body.method==='query'){
    if(p.request_type!=='call_function'||p.finality!=='final'||!methods.get(p.account_id)?.has(p.method_name))throw Error('Unsupported contract read.');
    if(typeof p.args_base64!=='string'||p.args_base64.length>4096||! /^[A-Za-z0-9+/]*={0,2}$/.test(p.args_base64))throw Error('Invalid arguments.');
    const args=JSON.parse(Buffer.from(p.args_base64,'base64').toString('utf8'));
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid arguments.');
    return {request_type:'call_function',account_id:p.account_id,method_name:p.method_name,args_base64:p.args_base64,finality:'final'};
  }
  if(body.method==='tx'){
    if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.tx_hash)||typeof p.sender_account_id!=='string'||p.sender_account_id.length>64||! /^[a-z0-9._-]{2,64}$/.test(p.sender_account_id))throw Error('Invalid transaction reference.');
    return {tx_hash:p.tx_hash,sender_account_id:p.sender_account_id,wait_until:'FINAL'};
  }
  throw Error('Only contract reads and transaction status are supported.');
}
export async function POST(request){
  let body,params;
  try {
    const text=await request.text();if(text.length>8192)return Response.json({error:{message:'Request too large.'}},{status:413});
    body=JSON.parse(text);params=allowedRead(body);
  }catch{return Response.json({error:{message:'Unsupported or invalid read request.'}},{status:400});}
  try{
    const response=await fetch('https://rpc.testnet.near.org',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(9000),
      body:JSON.stringify({jsonrpc:'2.0',id:'promisepay',method:body.method,params}),
    });
    if(!response.ok)return Response.json({error:{message:`NEAR RPC ${response.status}`}},{status:response.status===429?429:502});
    const data=await response.json();
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('NEAR read gateway unavailable:',error.name);
    return Response.json({error:{message:'The NEAR network is temporarily unavailable. Please try again.'}},{status:502});
  }
}
