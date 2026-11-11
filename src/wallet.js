import './polyfills.js';
import {readRpc} from './rpc.js';
import { actionCreators } from '@near-js/transactions';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import '@near-wallet-selector/modal-ui/styles.css';
import { networkConfig } from './network.js';

let selector, subscription, modal, pendingInit;
let activeNetwork = 'testnet';
let listener = () => {};
export function getConfig() { return networkConfig(activeNetwork, import.meta.env); }
export function currentAccount() { return selector?.store.getState().accounts.find(a => a.active)?.accountId || ''; }
export function initWallet(network, onChange = listener) {
  listener = onChange;
  if (pendingInit && activeNetwork === network) return pendingInit;
  if (selector && activeNetwork === network) { listener(currentAccount()); return Promise.resolve(selector); }
  activeNetwork = network;
  const config = getConfig();
  if (!config.configured) return Promise.reject(Error('This network is not available yet. Choose Testnet to try PromisePay.'));
  pendingInit = setupWalletSelector({network, modules: [setupMeteorWallet(), setupMyNearWallet()]}).then(value => {
    subscription?.unsubscribe(); selector = value;
    modal = setupModal(selector, {contractId: config.contractId});
    subscription = selector.store.observable.subscribe(state => {
      const account = state.accounts.find(a => a.active)?.accountId || '';
      if (account) modal.hide();
      listener(account);
    });
    return selector;
  }).finally(() => { pendingInit = null; });
  return pendingInit;
}
export async function connect(network, onChange = listener) {
  await initWallet(network, onChange);
  if (!selector.isSignedIn()) modal.show();
}
export async function disconnect() {
  if (selector?.isSignedIn()) await (await selector.wallet()).signOut();
  subscription?.unsubscribe(); subscription = undefined; selector = undefined; modal = undefined;
  listener('');
}
export async function rpc(method, params) {
  const config = getConfig();
  if (!config.configured) throw Error('Choose a configured network first.');
  const endpoint=activeNetwork==='testnet'&&!import.meta.env.DEV?'/api/near':config.rpc;
  return readRpc(endpoint, method, params);
}
export async function tokenView(method_name, args = {}, account_id = getConfig().contractId) {
  const result = await rpc('query', {request_type:'call_function',account_id,method_name,args_base64:Buffer.from(JSON.stringify(args)).toString('base64'),finality:'final'});
  return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result)));
}
export function view(method, args) { return tokenView(method, args); }
export async function send(receiverId, methodName, args, deposit = '0', gas = 150000000000000n) {
  if (!currentAccount()) throw Error('Connect your wallet to continue.');
  return (await selector.wallet()).signAndSendTransaction({receiverId, actions:[actionCreators.functionCall(methodName,args,gas,BigInt(deposit))]});
}
export function transact(method, args, deposit = '0') { return send(getConfig().contractId, method, args, deposit); }
export function fund(id, amount) { return send(getConfig().tokenId, 'ft_transfer_call', {receiver_id:getConfig().contractId,amount,msg:JSON.stringify({agreement_id:id})},'1',200000000000000n); }
export async function finalize(result) {
  const hash = result?.transaction?.hash;
  const signer = result?.transaction?.signer_id;
  if (!hash || !signer) throw Error('The wallet did not return a transaction result. Check your wallet history before retrying.');
  if (result.final_execution_status === 'FINAL') return result;
  return rpc('tx', {tx_hash:hash,sender_account_id:signer,wait_until:'FINAL'});
}
