import './polyfills.js';
import {RHEA,USDC,internalAmount,suppliedAmount,supplyConfirmed,withdrawalConfirmed,aprLabel} from './rhea.js';
import { initWallet, connect, disconnect, currentAccount, getConfig, view, tokenView, transact, fund, send, finalize } from './wallet.js';
import { parseUnits } from './network.js';
import { formatAmount, editableAmount, savingsBps, buildCommitments, allocationPreview, planReady, transactionFailure, transactionEvents, friendlyError } from './experience.js';

const $ = id => document.getElementById(id);
const state = {account:'',network:'testnet',plans:[],balances:{available:'0',savings:'0'},loaded:false,loading:false,tokenRegistered:null,busy:false,selectedPlan:null,bucket:'savings',scanEnd:0,scanComplete:false,generation:0,review:null};
let toastTimer, refreshTimer;
const names = {home:'PromisePay',dashboard:'Overview',plans:'My plans',savings:'Savings',activity:'Activity',guide:'How it works',demo:'Try the demo'};
const usdc = value => `${formatAmount(value)} USDC`;
function node(tag, text, className) { const el = document.createElement(tag); if(text !== undefined) el.textContent = text; if(className) el.className = className; return el; }
function button(text, className, callback) { const b = node('button', text, className); b.type='button'; b.addEventListener('click',callback); return b; }
function notice(message) { $('notice').textContent=message; $('notice').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('notice').hidden=true;},6500); }
function route() {
  const key = location.hash.slice(1).split('?')[0]; const page = names[key] ? key : 'home';
  document.body.classList.toggle('landing',page==='home');
  document.querySelectorAll('[data-page]').forEach(el=>{el.hidden=el.dataset.page!==page;});
  document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  document.title=`${names[page]} · PromisePay`;
  if(page==='activity') renderActivity();
  window.scrollTo({top:0});
}
function requireAccount() { if(state.account) return true; notice('Connect your wallet to continue.'); connectWallet(); return false; }
async function connectWallet() { try {await connect(state.network,onAccount);} catch(e) {notice(friendlyError(e));} }
function onAccount(account) {
  if(account===state.account) return;
  state.account=account;state.generation++;state.plans=[];state.loaded=false;state.loading=false;state.balances={available:'0',savings:'0'};state.tokenRegistered=null;state.scanEnd=0;state.scanComplete=false;
  if(!state.busy) document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('connect').textContent=account?'Disconnect wallet':'Connect wallet ↗';
  $('connect').title=account?`Connected as ${account}. Click to disconnect.`:'Connect your NEAR wallet';
  $('welcomeText').textContent=account?`Connected as ${account}. Your balances and plans update automatically.`:'Your money, your commitments, and your next step.';
  renderBalances(); renderPlans(); renderActivity();resetRhea();
  if(account){if(location.hash==='#home'||!location.hash)location.hash='dashboard';refreshData();}
}
function renderBalances() {
  document.querySelectorAll('[data-balance]').forEach(el=>{el.textContent=state.account&&state.loaded?formatAmount(state.balances[el.dataset.balance]):'—';});
  $('connectionPrompt').hidden=!!state.account;
  document.querySelectorAll('[data-withdraw]').forEach(el=>{el.disabled=!state.account||!state.loaded||BigInt(state.balances[el.dataset.withdraw])===0n||state.busy;});
  $('balanceStatus').textContent=!state.account?'Connect your wallet to load balances.':state.loading?'Updating from NEAR…':state.loaded?'Balances loaded from NEAR · Test USDC':'Balances are not available yet. Refresh to try again.';
  $('refresh').disabled=state.loading||!state.account||state.busy;
}
async function scanPlans(start=0, limit=40) {
  const plans=[]; let cursor=start,complete=false;
  for(let i=0;i<limit;i+=5){
    const values=await Promise.all(Array.from({length:5},(_,j)=>view('get_agreement',{id:String(start+i+j)})));
    for(let j=0;j<values.length;j++){cursor=start+i+j;if(!values[j]){complete=true;break;}plans.push(values[j]);cursor++;}
    if(complete)break;
  }
  return {plans,end:cursor,complete};
}
async function refreshData({more=false}={}) {
  if(!state.account||state.loading||state.busy)return;
  const generation=state.generation, account=state.account;
  state.loading=true;renderBalances();renderPlans();
  let balancesFailed=false, plansFailed=false;
  const tasks=await Promise.allSettled([
    view('get_balances',{account_id:account}),
    scanPlans(more?state.scanEnd:0,more?40:Math.max(40,state.scanEnd)),
    tokenView('storage_balance_of',{account_id:account},getConfig().tokenId),
  ]);
  if(generation!==state.generation)return;
  if(tasks[0].status==='fulfilled'){state.balances=tasks[0].value;state.loaded=true;}else{balancesFailed=true;}
  if(tasks[1].status==='fulfilled'){
    const result=tasks[1].value; const all=more?[...state.plans,...result.plans]:result.plans;
    state.plans=[...new Map(all.map(p=>[p.id,p])).values()];state.scanEnd=result.end;state.scanComplete=result.complete;
  }else{plansFailed=true;}
  if(tasks[2].status==='fulfilled')state.tokenRegistered=tasks[2].value!==null;
  state.loading=false;renderBalances();renderPlans();refreshRhea();
  if(balancesFailed)$('balanceStatus').textContent='Couldn’t update balances. Check your connection and refresh.';
  if(plansFailed)$('discoveryNote').textContent='We couldn’t load your plans from NEAR. Refresh to try again.';
}
function emptyState(title, description, action) {
  const box=node('div',undefined,'empty-state');box.append(node('span','✳','empty-icon'),node('h3',title),node('p',description));
  if(action)box.append(button(action.text,'btn secondary',action.run));return box;
}
function makePlanCard(plan) {
  const own=plan.owner===state.account,ready=planReady(plan),invite=!own&&!plan.accepted.includes(state.account);
  const card=node('article',undefined,'plan-card');const top=node('div',undefined,'plan-card-top');const title=node('div');title.append(node('div',plan.commitments.length?'Team plan':'Personal plan','plan-type'),node('h3',plan.title));top.append(title,node('span',invite?'Your invitation':ready?'Ready for payments':'Waiting for teammates',`status-pill${!ready?' pending':''}`));
  const desc=own?`${plan.savings_bps/100}% saved from your remainder${plan.commitments.length?` · ${plan.commitments.length} teammate${plan.commitments.length===1?'':'s'}`:''}`:`Created by ${plan.owner}`;
  const foot=node('div',undefined,'plan-card-foot');foot.append(node('span',own?'Created by you':'Shared with you'),button(invite?'Review invitation →':'Open plan →','btn secondary',()=>showPlan(plan.id)));card.append(top,node('p',desc),foot);return card;
}
function renderPlans() {
  const relevant=state.plans.filter(p=>p.owner===state.account||p.commitments.some(c=>c.account_id===state.account));
  const invites=relevant.filter(p=>p.owner!==state.account&&!p.accepted.includes(state.account));
  $('invitationBadge').hidden=!invites.length;$('invitationBadge').textContent=String(invites.length);
  for(const target of ['dashboardInvitations','planInvitations']){
    const parent=$(target);parent.replaceChildren();
    for(const p of invites){const item=node('div',undefined,'invitation');const copy=node('div');const share=p.commitments.find(c=>c.account_id===state.account);copy.append(node('span','You’re invited','eyebrow'),node('h3',p.title),node('p',`${p.owner} has set aside a ${usdc(share.amount)} commitment for you.`));item.append(copy,button('Review & accept →','btn primary',()=>showPlan(p.id)));parent.append(item);}
  }
  for(const [target,limit] of [['dashboardPlans',4],['plansList',Infinity]]){
    const parent=$(target);parent.replaceChildren();
    if(!state.account)parent.append(emptyState('Your plans belong here.','Connect your wallet and we’ll find the plans you’ve created or been invited to.',{text:'Connect wallet',run:connectWallet}));
    else if(!relevant.length&&state.loading)parent.append(node('p','Finding your plans…','loading-state shimmer'));
    else if(!relevant.length)parent.append(emptyState('Make room for your next chapter.','Start with a simple savings plan, or bring your team along.',{text:'Create your first plan +',run:openCreate}));
    else for(const p of relevant.slice().reverse().slice(0,limit))parent.append(makePlanCard(p));
  }
  $('loadMorePlans').hidden=!state.account||state.scanComplete||state.loading;
  $('discoveryNote').textContent=state.account&&!state.scanComplete&&!state.loading?'Showing plans found so far. Look for more plans if something is missing.':'';
  $('refreshPlans').disabled=state.loading||!state.account||state.busy;
}
function closeDialog(id) { $(id).close(); }
function openDialog(id) { $(id).showModal(); }
function openCreate() {
  if(!requireAccount()||state.busy)return;
  $('createError').textContent='';openDialog('planDialog');
}
function addTeammate() {
  if($('teammateRows').children.length>=10){notice('You can add up to 10 teammates.');return;}
  const id=crypto.randomUUID();const row=node('div',undefined,'teammate-row');
  const remove=button('×','icon-button remove-teammate',()=>row.remove());remove.setAttribute('aria-label','Remove teammate');
  const accountLabel=node('label','Teammate’s NEAR wallet');accountLabel.htmlFor=`account-${id}`;
  const account=node('input');account.id=`account-${id}`;account.name='teammateAccount';account.placeholder='e.g. name.testnet';account.required=true;account.autocapitalize='none';account.spellcheck=false;
  const amountLabel=node('label','How much are they owed?');amountLabel.htmlFor=`owed-${id}`;
  const amountWrap=node('div',undefined,'amount-input'),amount=node('input');amount.id=`owed-${id}`;amount.name='teammateAmount';amount.placeholder='0.00';amount.inputMode='decimal';amount.required=true;amountWrap.append(amount,node('span','USDC'));
  row.append(remove,accountLabel,account,amountLabel,amountWrap);$('teammateRows').append(row);
}
function reviewRequest({title,lines,note,run}) {
  $('reviewTitle').textContent=title;$('reviewContent').replaceChildren();
  for(const [label,value] of lines){const row=node('div',undefined,'review-line');row.append(node('span',label),node('span',value));$('reviewContent').append(row);}
  $('reviewContent').append(node('p',note,'review-description'));
  state.review={run,account:state.account,network:state.network};openDialog('reviewDialog');
}
function explorerLink(hash){return `${getConfig().explorer}/txns/${encodeURIComponent(hash)}`;}
async function perform({request,title,successMessage,kind,amount,planId,validate,onConfirmed}) {
  if(state.busy)return;
  if(!state.review||state.review.account!==state.account||state.review.network!==state.network){notice('Your wallet changed. Review the request again.');closeDialog('reviewDialog');return;}
  const account=state.account,network=state.network;
  state.busy=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('progressTitle').textContent='Approve in your wallet.';$('progressKicker').textContent='Your wallet. Your approval.';$('progressMessage').textContent='Review the request in your wallet. Nothing moves until you approve.';$('progressIcon').textContent='↗';$('progressIcon').className='progress-icon waiting';$('progressDone').hidden=true;$('progressExplorer').hidden=true;$('technicalDetails').hidden=true;
  $('connect').disabled=true;$('network').disabled=true;renderBalances();openDialog('progressDialog');
  let raw=null,hash='';
  try {
    raw=await request();hash=raw?.transaction?.hash||'';
    if(hash){$('progressExplorer').href=explorerLink(hash);$('progressExplorer').hidden=false;}
    $('progressTitle').textContent='Confirming on NEAR.';$('progressKicker').textContent='One moment';$('progressMessage').textContent='Your request was submitted. We’re waiting for the network to confirm the result.';
    raw=await finalize(raw);
    const failure=transactionFailure(raw);if(failure)throw Error(failure);
    if(validate)validate(raw);
    if(onConfirmed)onConfirmed(raw,account,network);
    saveActivity({account,network,title,amount,kind,hash,planId,date:new Date().toISOString(),success:true});
    $('progressTitle').textContent=successMessage;$('progressKicker').textContent='Confirmed on NEAR';$('progressIcon').textContent='✓';$('progressMessage').textContent='Your balances and plans are being updated. You can find this transaction in Activity.';
    if(kind==='create'){
      const encoded=raw.status?.SuccessValue;
      if(encoded){try{const id=JSON.parse(atob(encoded));state.selectedPlan=String(id);}catch{}}
      $('planForm').reset();$('teammateFields').hidden=true;$('teammateRows').replaceChildren();
    }
    state.busy=false;
    if(account===state.account&&network===state.network)await refreshData();
    $('progressMessage').textContent='Your request is confirmed. Your workspace shows the latest balances and plans.';
    renderActivity();
  } catch(error) {
    $('progressTitle').textContent=hash?'Check the transaction result.':'Request not completed.';$('progressKicker').textContent=hash?'Take a moment before retrying':'You’re still in control';$('progressIcon').textContent='!';$('progressMessage').textContent=friendlyError(error);
    $('technicalDetails').hidden=false;$('technicalResult').textContent=JSON.stringify({message:error.message,transaction:raw},null,2);
    if(hash){saveActivity({account,network,title,amount,kind,hash,planId,date:new Date().toISOString(),success:false});}
    state.busy=false;if(account===state.account)await refreshData();
  } finally {
    state.busy=false;$('connect').disabled=false;$('network').disabled=false;$('progressIcon').classList.remove('waiting');$('progressDone').hidden=false;state.review=null;renderBalances();
  }
}
function storageKey(account=state.account,network=state.network){return `promisepay-activity:${network}:${account}`;}
function activityItems(){try{return JSON.parse(localStorage.getItem(storageKey())||'[]');}catch{return [];}}
function saveActivity(item){try{const key=storageKey(item.account,item.network);let old=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(old))old=[];localStorage.setItem(key,JSON.stringify([item,...old].slice(0,60)));}catch{/* Activity storage is optional. */}}
function renderActivity(){
  const parent=$('activityList');parent.replaceChildren();const items=state.account?activityItems():[];
  if(!items.length){parent.append(emptyState('Your next step starts here.',state.account?'Transactions you make here will appear as clear summaries.':'Connect a wallet to see its activity from this browser.'));return;}
  for(const item of items){const row=node('article',undefined,'activity-row');row.append(node('span',item.success?'✓':'!','icon-tile'));const copy=node('div');copy.append(node('h3',item.title),node('p',`${item.success?'Confirmed':'Needs review'}${item.amount?` · ${usdc(item.amount)}`:''}`));const right=node('div');right.append(node('span',new Date(item.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),'activity-date'));if(item.hash){const a=node('a','View transaction ↗','text-link');a.href=explorerLink(item.hash);a.target='_blank';a.rel='noopener noreferrer';right.append(a);}row.append(copy,right);parent.append(row);}
}
function showPlan(id) {
  const plan=state.plans.find(p=>p.id===id);if(!plan)return;
  state.selectedPlan=id;const box=$('detailContent');box.replaceChildren();
  const title=node('h2',plan.title);title.id='detailTitle';box.append(title,node('p',plan.owner===state.account?'Your plan':'Created by '+plan.owner,'review-description'));
  box.append(node('span',planReady(plan)?'Ready for payments':'Waiting for teammate acceptance',`status-pill${planReady(plan)?'':' pending'}`));
  const savings=node('div',undefined,'detail-total');savings.append(node('span','Save from your remainder'),node('strong',`${plan.savings_bps/100}%`));box.append(savings);
  for(let i=0;i<plan.commitments.length;i++){
    const c=plan.commitments[i],paid=BigInt(plan.paid[i]||'0'),remaining=BigInt(c.amount)-paid;const row=node('div',undefined,'plan-person');const person=node('div');person.append(node('strong',c.account_id===state.account?'You':c.account_id),node('small',`${plan.accepted.includes(c.account_id)?'Accepted':'Awaiting acceptance'} · ${usdc(paid)} allocated`));row.append(person,node('b',`${usdc(remaining)} remaining`));box.append(row);
  }
  if(!plan.commitments.length)box.append(node('p','A personal savings plan. Each payment is split between your savings and available balance.','review-description'));
  const actions=node('div',undefined,'plan-actions');const participant=plan.commitments.some(c=>c.account_id===state.account);
  if(participant&&!plan.accepted.includes(state.account))actions.append(button('Review & accept plan →','btn primary',()=>reviewRequest({title:'Accept this plan?',lines:[['Plan',plan.title],['Created by',plan.owner],['Your commitment',usdc(plan.commitments.find(c=>c.account_id===state.account).amount)],['Wallet',state.account]],note:'Accepting records your agreement to participate. It does not send USDC. A small test NEAR network fee applies.',run:()=>perform({request:()=>transact('accept_agreement',{id:plan.id}),title:`Accepted ${plan.title}`,successMessage:'You’re part of the plan.',kind:'accept',planId:plan.id})})));
  if(planReady(plan)&&plan.owner===state.account)actions.append(button('Add a payment ↗','btn primary',()=>openPayment(plan)));
  else if(!planReady(plan))box.append(node('p','Payments become available after every teammate has accepted.','fee-note'));
  else box.append(node('p','Your allocated share appears in your available balance. Withdraw it from Overview when you’re ready.','fee-note'));
  box.append(actions);
  const detail=node('details',undefined,'detail-meta');detail.append(node('summary','View technical details'),node('p',`Agreement ${plan.id} · Contract ${getConfig().contractId} · ${state.network}`));box.append(detail);openDialog('detailDialog');
}
function openPayment(plan) {
  if(!requireAccount()||state.busy)return;
  state.selectedPlan=plan.id;closeDialog('detailDialog');$('paymentForm').reset();$('paymentError').textContent='';$('paymentPlanName').textContent=plan.title;$('paymentPreview').replaceChildren();openDialog('paymentDialog');
}
function splitSummary(target, split) {
  target.replaceChildren();for(const [key,title,description] of [['team','Team commitments','Allocated before your share'],['savings','Set aside for you','Saved from your remainder'],['available','Yours to spend','Available in PromisePay']]){const row=node('div',undefined,'split-line');const left=node('div');left.append(node('strong',title),node('small',description));row.append(left,node('b',usdc(split[key])));target.append(row);}
}
function previewPayment(){try{const amount=parseUnits($('paymentAmount').value.trim(),6);const plan=state.plans.find(p=>p.id===state.selectedPlan);if(plan)splitSummary($('paymentPreview'),allocationPreview(amount,plan));$('paymentError').textContent='';}catch{$('paymentPreview').replaceChildren();}}
async function openWithdrawal(bucket) {
  if(!requireAccount()||state.busy)return;
  if(!state.loaded){notice('Wait for your latest balance to load.');return;}
  if(BigInt(state.balances[bucket])===0n){notice('There is nothing to withdraw from this balance yet.');return;}
  state.bucket=bucket;$('withdrawForm').reset();$('withdrawTitle').textContent=bucket==='savings'?'Withdraw savings.':'Withdraw available funds.';$('withdrawDescription').textContent=`${usdc(state.balances[bucket])} available. Funds return to ${state.account}.`;$('withdrawError').textContent='';$('tokenSetup').hidden=state.tokenRegistered!==false;$('reviewWithdrawal').disabled=state.tokenRegistered===false;openDialog('withdrawDialog');
}
function showDemo(){
  try{const amount=parseUnits($('demoPayment').value.trim(),6);const teamInput=$('demoTeam').value.trim();const team=/^0(\.0*)?$/.test(teamInput)?'0':parseUnits(teamInput,6);const split=allocationPreview(amount,{commitments:[{amount:team}],paid:['0'],savings_bps:savingsBps($('demoSavings').value)});splitSummary($('demoSplit'),split);$('demoError').textContent='';}catch(e){$('demoError').textContent=friendlyError(e);}
}


let rheaState={asset:null,supplied:'0',registered:false,mode:'start',loading:false};
function pendingKey(account=state.account,network=state.network){return `promisepay-rhea-pending:${network}:${account}`;}
function pendingAmount(){try{return localStorage.getItem(pendingKey())||'';}catch{return '';}}
function resetRhea(){rheaState.asset=null;rheaState.supplied='0';$('rheaBalance').textContent='—';$('rheaRate').textContent='—';$('rheaStatus').textContent='Connect your wallet to check RHEA.';for(const id of ['earnStart','earnWithdraw'])$(id).disabled=true;$('earnSupply').hidden=true;$('rheaRetry').hidden=true;$('rheaDetails').hidden=true;}
async function refreshRhea(){
  if(rheaState.loading)return;
  const account=state.account,generation=state.generation;
  if(!account||state.network!=='testnet'||getConfig().tokenId!==USDC){resetRhea();return;}
  rheaState.loading=true;$('rheaRetry').disabled=true;$('rheaStatus').textContent='Checking the lending market…';
  let stage='market';
  try{
    const asset=await tokenView('get_asset',{token_id:USDC},RHEA);
    stage='wallet position';const position=await tokenView('get_account',{account_id:account},RHEA);
    stage='wallet registration';const storage=await tokenView('storage_balance_of',{account_id:account},RHEA);
    if(generation!==state.generation)return;
    if(asset.token_id!==USDC||!asset.config||!Number.isInteger(asset.config.extra_decimals))throw Error('This lending market is unavailable.');
    const supplied=suppliedAmount(position,USDC,asset.config.extra_decimals);
    rheaState={...rheaState,asset,supplied,registered:!!storage};
    $('rheaRetry').hidden=true;$('rheaDetails').hidden=true;
    $('rheaBalance').textContent=usdc(supplied);$('rheaRate').textContent=aprLabel(asset.supply_apr);
    const pending=pendingAmount();$('earnSupply').hidden=!pending;$('earnSupply').disabled=state.busy||!asset.config.can_deposit;
    $('earnStart').disabled=state.busy||!state.loaded||BigInt(state.balances.savings)===0n||!asset.config.can_deposit||!!pending;
    $('earnWithdraw').disabled=state.busy||BigInt(supplied)===0n||!asset.config.can_withdraw;
    $('rheaStatus').textContent=pending?`${usdc(pending)} moved to your wallet for lending. Continue the deposit when ready.`:'Live testnet market. Rates change; returns are not guaranteed.';
  }catch(e){if(generation===state.generation){resetRhea();$('rheaStatus').textContent='We couldn’t check RHEA. Your funds have not moved. Try again.';$('rheaRetry').hidden=false;$('rheaDetails').hidden=false;$('rheaError').textContent=`Checking ${stage}: ${e.message||String(e)}`;}}
  finally{rheaState.loading=false;$('rheaRetry').disabled=false;}
}
async function openEarn(mode){
  if(!requireAccount()||state.busy)return;
  if(rheaState.loading){notice('The lending market is still loading. Try again in a moment.');return;}
  await refreshRhea();if(!rheaState.asset)return;
  rheaState.mode=mode;
  if(mode!=='withdraw'&&!rheaState.registered){
    try{const bounds=await tokenView('storage_balance_bounds',{},RHEA);
      const cost=String(Number(bounds.min)/1e24);
      reviewRequest({title:'Set up your RHEA account.',lines:[['Wallet',state.account],['One-time storage deposit',`${cost} test NEAR`]],note:'This registers your own account with RHEA. No USDC moves. After confirmation, choose Start earning again.',run:()=>perform({request:()=>send(RHEA,'storage_deposit',{account_id:state.account,registration_only:true},bounds.min),title:'Registered with RHEA',successMessage:'Your RHEA account is ready.',kind:'rhea-register'})});
    }catch(e){notice(friendlyError(e));}return;
  }
  const amount=mode==='withdraw'?rheaState.supplied:mode==='supply'?pendingAmount():state.balances.savings;
  if(!amount||BigInt(amount)<=0n){notice('There is no balance for this step.');return;}
  $('earnTitle').textContent=mode==='withdraw'?'Withdraw from RHEA.':mode==='supply'?'Complete your RHEA deposit.':'Move savings to your wallet.';
  $('earnDescription').textContent=mode==='withdraw'?'Funds return to your wallet. Availability depends on market liquidity.':mode==='supply'?'Approve lending from your wallet to your own RHEA position. The rate is variable.':'Step 1 of 2. Withdraw savings to your wallet. Then choose Continue deposit to supply them to RHEA.';
  $('earnAmount').value=editableAmount(amount);$('earnError').textContent='';openDialog('earnDialog');
}
$('rheaRetry').onclick=()=>refreshRhea();
$('earnStart').onclick=()=>openEarn('start');$('earnSupply').onclick=()=>openEarn('supply');$('earnWithdraw').onclick=()=>openEarn('withdraw');
$('earnForm').onsubmit=async event=>{
  event.preventDefault();try{
    const amount=parseUnits($('earnAmount').value.trim(),6),mode=rheaState.mode,account=state.account,network=state.network,asset=rheaState.asset;
    if(!asset||network!=='testnet'||getConfig().tokenId!==USDC)throw Error('Choose the supported testnet USDC market.');
    if(mode==='start'){
      if(BigInt(amount)>BigInt(state.balances.savings))throw Error('Choose an amount within your savings balance.');
      reviewRequest({title:'Step 1 · Move savings to your wallet.',lines:[['Amount',usdc(amount)],['Destination',account]],note:'This step does not start earning. After it confirms, select Continue deposit and approve the RHEA transfer. If you stop, the funds stay in your wallet.',run:()=>perform({request:()=>transact('withdraw',{bucket:'savings',amount},'1'),title:'Moved savings to wallet for lending',successMessage:'Step 1 done. Continue your deposit.',kind:'rhea-prepare',amount,validate:r=>{if(!transactionEvents(r).some(e=>e.event==='withdrawal_resolved'&&e.success===true))throw Error('Savings withdrawal was not confirmed. Do not deposit yet.');},onConfirmed:(_,a,n)=>localStorage.setItem(pendingKey(a,n),amount)})});
    }else if(mode==='supply'){
      if(!asset.config.can_deposit)throw Error('RHEA deposits are paused.');
      const walletBalance=await tokenView('ft_balance_of',{account_id:account},USDC);
      if(state.account!==account||state.network!==network)throw Error('Your wallet changed. Review the deposit again.');
      if(BigInt(amount)>BigInt(walletBalance))throw Error('Your wallet does not have enough USDC for this deposit.');
      if(BigInt(amount)>BigInt(pendingAmount()||'0'))throw Error('Choose an amount within your pending deposit.');
      reviewRequest({title:'Step 2 · Supply to RHEA.',lines:[['Amount',usdc(amount)],['Position owner',account],['Variable APR',aprLabel(asset.supply_apr)]],note:'This lends test USDC to RHEA. Protocol risks apply and withdrawal depends on liquidity. No borrowing is requested.',run:()=>perform({request:()=>send(USDC,'ft_transfer_call',{receiver_id:RHEA,amount,msg:''},'1',250000000000000n),title:'Supplied savings to RHEA',successMessage:'Your RHEA deposit is confirmed.',kind:'rhea-supply',amount,validate:r=>{if(!supplyConfirmed(r,amount))throw Error('The full RHEA deposit was not confirmed. Check your wallet and RHEA balances before retrying.');},onConfirmed:(_,a,n)=>{const key=pendingKey(a,n),left=BigInt(localStorage.getItem(key)||'0')-BigInt(amount);if(left>0n)localStorage.setItem(key,left.toString());else localStorage.removeItem(key);}})});
    }else{
      if(!asset.config.can_withdraw||BigInt(amount)>BigInt(rheaState.supplied))throw Error('Choose an amount within your withdrawable supplied balance.');
      reviewRequest({title:'Withdraw supplied savings.',lines:[['Amount',usdc(amount)],['Send to',account]],note:'Funds return to your wallet, separate from your PromisePay savings. Market liquidity may limit withdrawals. A network fee applies.',run:()=>perform({request:()=>send(RHEA,'execute',{actions:[{Withdraw:{token_id:USDC,amount:internalAmount(amount,asset.config.extra_decimals)}}]},'1',250000000000000n),title:'Withdrew from RHEA',successMessage:'RHEA funds returned to your wallet.',kind:'rhea-withdraw',amount,validate:r=>{if(!withdrawalConfirmed(r,account,amount))throw Error('A matching USDC transfer was not confirmed. Check the updated RHEA balance and transaction details before retrying.');}})});
    }
  }catch(e){$('earnError').textContent=friendlyError(e);}
};

$('connect').onclick=async()=>{if(state.busy)return;if(state.account){try{await disconnect();onAccount('');}catch(e){notice(friendlyError(e));}}else connectWallet();};
document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=connectWallet);
document.querySelectorAll('[data-create]').forEach(b=>b.onclick=openCreate);
document.querySelectorAll('[data-withdraw]').forEach(b=>b.onclick=()=>openWithdrawal(b.dataset.withdraw));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
document.querySelectorAll('input[name=planType]').forEach(radio=>radio.onchange=()=>{const team=document.querySelector('input[name=planType]:checked').value==='team';$('teammateFields').hidden=!team;$('teammateRows').querySelectorAll('input').forEach(i=>{i.disabled=!team;});if(team&&!$('teammateRows').children.length)addTeammate();});
$('addTeammate').onclick=addTeammate;
$('refresh').onclick=()=>refreshData();$('refreshPlans').onclick=()=>refreshData();$('loadMorePlans').onclick=()=>refreshData({more:true});
$('planForm').onsubmit=event=>{
  event.preventDefault();try{
    if(!requireAccount())return;const title=$('planName').value.trim();if(!title)throw Error('Give your plan a name first.');const team=document.querySelector('input[name=planType]:checked').value==='team';
    const rows=[...$('teammateRows').children].map(row=>({account:row.querySelector('[name=teammateAccount]').value,amount:row.querySelector('[name=teammateAmount]').value}));
    if(team&&!rows.length)throw Error('Add at least one teammate, or choose Just for me.');
    const commitments=team?buildCommitments(rows,state.account):[];const bps=savingsBps($('savingsPercent').value);
    const lines=[['Plan',title],['Type',team?'My team & me':'Just for me'],...commitments.map(c=>[c.account_id,usdc(c.amount)]),['Save from your share',`${bps/100}%`],['Storage deposit','0.1 test NEAR'],['Wallet',state.account]];
    reviewRequest({title:'Your plan, at a glance.',lines,note:'A small test NEAR network fee also applies. Teammates must accept before the plan can receive payments.',run:()=>perform({request:()=>transact('create_agreement',{title,commitments,savings_bps:bps},'100000000000000000000000'),title:`Created ${title}`,successMessage:'Your plan is ready.',kind:'create'})});$('createError').textContent='';
  }catch(e){$('createError').textContent=friendlyError(e);}
};
$('paymentAmount').oninput=previewPayment;
$('paymentForm').onsubmit=event=>{
  event.preventDefault();try{
    const plan=state.plans.find(p=>p.id===state.selectedPlan);if(!plan||!planReady(plan))throw Error('Refresh this plan and wait for all teammates to accept.');
    const amount=parseUnits($('paymentAmount').value.trim(),6);const split=allocationPreview(amount,plan);
    reviewRequest({title:'A payment with a plan.',lines:[['Plan',plan.title],['Total payment',usdc(amount)],['Team commitments',usdc(split.team)],['Your savings',usdc(split.savings)],['Yours to spend',usdc(split.available)],['From wallet',state.account]],note:'This sends test USDC from your wallet to the plan. A small test NEAR network fee applies. The split is an estimate; the contract uses the latest plan state.',run:()=>perform({request:()=>fund(plan.id,amount),title:`Payment to ${plan.title}`,successMessage:'Your payment found its place.',kind:'fund',amount,planId:plan.id,validate:result=>{if(!transactionEvents(result).some(e=>e.event==='allocated'&&e.agreement_id===plan.id))throw Error('No allocation was confirmed. Your USDC may have been refunded. Check the transaction details before retrying.');}})});
  }catch(e){$('paymentError').textContent=friendlyError(e);}
};
$('withdrawAll').onclick=()=>{$('withdrawAmount').value=editableAmount(state.balances[state.bucket]);};
$('withdrawForm').onsubmit=event=>{
  event.preventDefault();try{
    const bucket=state.bucket,amount=parseUnits($('withdrawAmount').value.trim(),6);if(BigInt(amount)>BigInt(state.balances[bucket]))throw Error(`You can withdraw up to ${usdc(state.balances[bucket])}.`);
    if(state.tokenRegistered===false)throw Error('Complete USDC setup for this wallet first.');
    reviewRequest({title:'Back to your wallet.',lines:[['Withdraw from',bucket==='savings'?'Personal savings':'Available balance'],['Amount',usdc(amount)],['Send to',state.account]],note:'The funds return to your connected wallet. A small test NEAR network fee applies.',run:()=>perform({request:()=>transact('withdraw',{bucket,amount},'1'),title:`Withdrew ${bucket==='savings'?'savings':'available funds'}`,successMessage:'Your funds are back with you.',kind:'withdraw',amount,validate:result=>{if(!transactionEvents(result).some(e=>e.event==='withdrawal_resolved'&&e.success===true))throw Error('Withdrawal was not completed. Your PromisePay balance may have been restored. Check the updated balance and transaction details.');}})});
  }catch(e){$('withdrawError').textContent=friendlyError(e);}
};
$('registerToken').onclick=async()=>{
  try{const bounds=await tokenView('storage_balance_bounds',{},getConfig().tokenId);const amount=bounds.min;const whole=BigInt(amount)/10n**24n;const fraction=(BigInt(amount)%10n**24n).toString().padStart(24,'0').replace(/0+$/,'');
    reviewRequest({title:'Set up USDC for your wallet.',lines:[['Wallet',state.account],['Registration cost',`${whole}${fraction?'.'+fraction:''} test NEAR`]],note:'This is a one-time storage deposit paid to the USDC token contract, plus a small network fee.',run:()=>perform({request:()=>send(getConfig().tokenId,'storage_deposit',{account_id:state.account,registration_only:true},amount),title:'Set up USDC for wallet',successMessage:'Your wallet is ready for USDC.',kind:'register'})});
  }catch(e){$('withdrawError').textContent=friendlyError(e);}
};
$('confirmAction').onclick=()=>state.review?.run();
$('progressDone').onclick=()=>{closeDialog('progressDialog');if(location.hash==='#home')location.hash='dashboard';};
$('progressDialog').addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});
$('demoForm').onsubmit=e=>{e.preventDefault();showDemo();};
$('network').onchange=async()=>{if(state.busy)return;try{await disconnect();state.network=$('network').value;state.generation++;$('networkLabel').textContent=state.network==='testnet'?'Testnet':'Mainnet';await initWallet(state.network,onAccount);}catch(e){notice(friendlyError(e));}};
window.addEventListener('hashchange',route);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData();});
route();renderBalances();renderPlans();renderActivity();showDemo();
initWallet(state.network,onAccount).catch(e=>notice(friendlyError(e)));
refreshTimer=setInterval(()=>{if(!document.hidden)refreshData();},30000);
