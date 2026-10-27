import {actionCreators} from '@near-js/transactions';
import {setupWalletSelector} from '@near-wallet-selector/core';
import {setupModal} from '@near-wallet-selector/modal-ui';
import {setupMeteorWallet} from '@near-wallet-selector/meteor-wallet';
import {setupMyNearWallet} from '@near-wallet-selector/my-near-wallet';
import '@near-wallet-selector/modal-ui/styles.css';
import {networkConfig} from './network.js';
let selector,config,subscription;
export async function initWallet(network,onChange=()=>{}) {
 const nextConfig=networkConfig(network,import.meta.env);
 if(!nextConfig.configured) throw Error(`${network}: contract and token addresses are not configured. No live deposits available.`);
 subscription?.unsubscribe();
 selector=await setupWalletSelector({network,modules:[setupMeteorWallet(),setupMyNearWallet()]});
 config=nextConfig;
 subscription=selector.store.observable.subscribe(state=>{
   const active=state.accounts.find(account=>account.active);
   onChange(active?.accountId||'');
 });
 return selector;
}
export async function connect(network,onChange){
 const walletSelector=selector||await initWallet(network,onChange);
 if(!walletSelector.isSignedIn()) setupModal(walletSelector,{contractId:config.contractId}).show();
 return walletSelector;
}
export async function disconnect(){
 if(selector?.isSignedIn()) await(await selector.wallet()).signOut();
 subscription?.unsubscribe();subscription=undefined;selector=undefined;config=undefined;
}
export async function transact(methodName,args,deposit='0'){
 if(!selector||!config||!selector.isSignedIn())throw Error('Connect a wallet first');
 return (await selector.wallet()).signAndSendTransaction({receiverId:config.contractId,actions:[actionCreators.functionCall(methodName,args,150000000000000n,BigInt(deposit))]});
}
export async function fund(id,amount){if(!selector?.isSignedIn())throw Error('Connect a wallet first');return(await selector.wallet()).signAndSendTransaction({receiverId:config.tokenId,actions:[actionCreators.functionCall('ft_transfer_call',{receiver_id:config.contractId,amount,msg:JSON.stringify({agreement_id:id})},200000000000000n,1n)]});}

export async function view(methodName,args={}) {
 if(!config?.configured)throw Error('Select and connect a configured network first');
 const args_base64=btoa(unescape(encodeURIComponent(JSON.stringify(args))));
 const response=await fetch(config.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'promisepay',method:'query',params:{request_type:'call_function',account_id:config.contractId,method_name:methodName,args_base64,finality:'final'}})});
 const data=await response.json();if(data.error)throw Error(data.error.message||'RPC failed');return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result.result)));
}
export function currentAccount(){return selector?.store.getState().accounts.find(a=>a.active)?.accountId||'';}

