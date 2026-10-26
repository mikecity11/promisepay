export const NETWORKS = Object.freeze({
  testnet: {networkId:'testnet',rpc:'https://rpc.testnet.near.org',explorer:'https://testnet.nearblocks.io'},
  mainnet: {networkId:'mainnet',rpc:'https://rpc.mainnet.near.org',explorer:'https://nearblocks.io'}
});
export function networkConfig(network, env={}) {
  if (!Object.hasOwn(NETWORKS,network)) throw Error('Unknown NEAR network');
  const prefix=network.toUpperCase();
  const contractId=env[`VITE_${prefix}_CONTRACT_ID`]||'';
  const tokenId=env[`VITE_${prefix}_TOKEN_ID`]||'';
  if (contractId && !validAccount(contractId)) throw Error('Invalid contract account');
  if (tokenId && !validAccount(tokenId)) throw Error('Invalid token account');
  if(network==='mainnet' && [contractId,tokenId].some(x=>x.endsWith('.testnet'))) throw Error('Testnet accounts cannot be used in mainnet configuration');
  return {...NETWORKS[network],contractId,tokenId,configured:!!(contractId&&tokenId)};
}
export function validAccount(id){return typeof id==='string'&&id.length>=2&&id.length<=64&&/^(([a-z0-9]+[-_])*[a-z0-9]+\.)*([a-z0-9]+[-_])*[a-z0-9]+$/.test(id);}
export function parseUnits(value,decimals=6){
  if(!Number.isInteger(decimals)||decimals<0||decimals>24||!/^\d+(\.\d+)?$/.test(value))throw Error('Invalid token amount');
  const [whole,fraction='']=value.split('.');if(fraction.length>decimals)throw Error('Too many decimal places');
  const amount=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
  if(amount<=0n||amount>2n**128n-1n)throw Error('Invalid token amount');return amount.toString();
}
