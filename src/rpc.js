// Retry read-only requests only. Never retry transaction submission.
export async function readRpc(url, method, params, {fetcher=fetch, pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)), timeout=12000}={}) {
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
    let retry=false;
    try {
      const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'promisepay',method,params}),signal:controller.signal});
      if(!response.ok){retry=response.status===429||response.status>=500;throw Error(`NEAR RPC ${response.status}`);}
      const data=await response.json();
      if(data.error){const message=typeof data.error.data==='string'?data.error.data:JSON.stringify(data.error.data||data.error.message||data.error);retry=/timeout|temporar|too many|rate limit|unavailable/i.test(message);throw Error(message);}
      return data.result;
    } catch(error){lastError=error;retry=retry||error.name==='AbortError'||error instanceof TypeError;if(!retry||attempt===2)throw error;
    } finally {clearTimeout(timer);}
    await pause(600*(attempt+1));
  }
  throw lastError;
}
