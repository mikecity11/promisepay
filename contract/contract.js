import {NearBindgen,near,call,view,initialize,NearPromise,LookupMap} from 'near-sdk-js';
import {distribute,uint} from './ledger.js';
const GAS=30000000000000n;
function check(ok,message){if(!ok)throw Error(message);}
function account(id){check(typeof id==='string'&&id.length>=2&&id.length<=64&&/^(([a-z0-9]+[-_])*[a-z0-9]+\.)*([a-z0-9]+[-_])*[a-z0-9]+$/.test(id),'Invalid account');}
@NearBindgen({requireInit:true})
export class PromisePay {
 constructor(){this.token='';this.next=0;this.pendingNext=0;this.agreements=new LookupMap('a');this.balances=new LookupMap('b');this.pending=new LookupMap('p');}
 @initialize({})
 init({token_id}){check(near.predecessorAccountId()===near.currentAccountId(),'Initialize with deployment account');account(token_id);this.token=token_id;}
 credit(id,bucket,amount){const key=id+':'+bucket;const old=BigInt(this.balances.get(key)||'0');const next=old+BigInt(amount);check(next<2n**128n,'Balance overflow');this.balances.set(key,next.toString());}
 @call({payableFunction:true})
 create_agreement({title,commitments=[],savings_bps=500}){
 check(near.attachedDeposit()>=100000000000000000000000n,'Attach 0.1 NEAR for storage');
 check(typeof title==='string'&&title.length>0&&title.length<=120,'Invalid title');check(commitments.length<=10,'Maximum 10 recipients');
 const owner=near.predecessorAccountId(),seen=new Set();let total=0n;
 for(const c of commitments){account(c.account_id);check(c.account_id!==owner&&!seen.has(c.account_id),'Duplicate or owner recipient');seen.add(c.account_id);check(uint(c.amount)>0n,'Empty commitment');total+=uint(c.amount);}
 check(total<2n**128n,'Commitment overflow');check(Number.isInteger(savings_bps)&&savings_bps>=0&&savings_bps<=10000,'Invalid savings rate');
 const id=String(this.next++);this.agreements.set(id,{id,title,owner,commitments,savings_bps,accepted:[],paid:commitments.map(()=> '0')});return id;
 }
 @call({})
 accept_agreement({id}){const a=this.agreements.get(id);check(a,'Agreement missing');const who=near.predecessorAccountId();check(a.commitments.some(c=>c.account_id===who),'Not a participant');check(!a.accepted.includes(who),'Already accepted');a.accepted.push(who);this.agreements.set(id,a);}
 @call({})
 ft_on_transfer({sender_id,amount,msg}){
 check(near.predecessorAccountId()===this.token,'Wrong token contract');const {agreement_id}=JSON.parse(msg);const a=this.agreements.get(agreement_id);check(a,'Agreement missing');
 check(a.accepted.length===a.commitments.length,'Participants must accept first');
 const r=distribute(amount,a.commitments,a.paid,a.savings_bps);
 r.shares.forEach((value,i)=>{this.credit(a.commitments[i].account_id,'available',value);a.paid[i]=(BigInt(a.paid[i])+BigInt(value)).toString();});
 this.credit(a.owner,'savings',r.savings);this.credit(a.owner,'available',r.available);this.agreements.set(agreement_id,a);
 near.log(JSON.stringify({event:'allocated',agreement_id,sender_id,amount,...r}));return '0';
 }
 @view({}) get_agreement({id}){return this.agreements.get(id);}
 @view({}) get_config(){return {token_id:this.token,yield_enabled:false};}
 @view({}) get_balances({account_id}){return {available:this.balances.get(account_id+':available')||'0',savings:this.balances.get(account_id+':savings')||'0'};}
 @call({payableFunction:true})
 withdraw({bucket,amount}){
 check(near.attachedDeposit()===1n,'Attach one yoctoNEAR');check(bucket==='available'||bucket==='savings','Invalid balance');const value=uint(amount);check(value>0n,'Empty withdrawal');
 const owner=near.predecessorAccountId(),key=owner+':'+bucket,balance=BigInt(this.balances.get(key)||'0');check(balance>=value,'Insufficient balance');
 this.balances.set(key,(balance-value).toString());const id=String(this.pendingNext++);this.pending.set(id,{owner,bucket,amount});
 return NearPromise.new(this.token).functionCall('ft_transfer',JSON.stringify({receiver_id:owner,amount,memo:'PromisePay withdrawal'}),1n,GAS).then(NearPromise.new(near.currentAccountId()).functionCall('resolve_withdraw',JSON.stringify({id}),0n,GAS)).asReturn();
 }
 @call({privateFunction:true})
 resolve_withdraw({id}){const p=this.pending.get(id);check(p,'Withdrawal missing');let success=true;try{near.promiseResult(0);}catch{success=false;}
 if(!success)this.credit(p.owner,p.bucket,p.amount);this.pending.remove(id);near.log(JSON.stringify({event:'withdrawal_resolved',id,success}));return success;
 }
}
