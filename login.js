const $=selector=>document.querySelector(selector);
const query=new URLSearchParams(location.search);
const auth=window.EasyFarmAuth;
const isCallback=query.has('callback');
let portal=query.get('portal')==='grower'?'grower':'buyer';
let busy=false, onboarding=false, googleAvailable=false;
function showError(copy){$('#auth-error').textContent=copy;$('#auth-error').hidden=false;}
function renderAuth(){
 const grower=portal==='grower';
 document.querySelectorAll('[data-portal]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.portal===portal));button.disabled=busy;});
 $('#portal-label').textContent=(grower?'GROWER':'BUYER')+' PORTAL';
 $('#auth-title').textContent=onboarding?(grower?'Tell us about your farm.':'Tell us about your business.'):(grower?'Your harvest starts here.':'Your next connection.');
 $('#auth-description').textContent=onboarding?'You’re signed in with Google. Set up your EasyFarm portal to get started.':(grower?'Sign in with Google to manage your farm, harvest and incoming offers.':'Sign in with Google to source produce and manage your purchases.');
 $('#organization-label').textContent=grower?'Farm name':'Business name';
 $('#google-signin').hidden=onboarding;$('#google-status').hidden=onboarding;
 $('#google-signin').disabled=busy||!googleAvailable;
 $('#profile-form').hidden=!onboarding;
 $('#profile-submit').textContent=busy?'Opening your portal…':'Open '+portal+' portal';
 $('#profile-submit').disabled=busy;
 $('#auth-footnote').textContent=onboarding?'Choose the portal for this Google account. It stays connected to this account.':'One Google sign-in for new and returning users. Your existing account always opens its own portal.';
 // Clerk consumes its own callback parameters. Keep them intact until the SDK
 // has finished the provider return, including additional signup requirements.
 const url=new URL(location.href);url.searchParams.set('portal',portal);if(onboarding)url.searchParams.set('finish','1');history.replaceState(null,'',url);
 document.title=(grower?'Grower':'Buyer')+' portal · EasyFarm';
}
document.querySelectorAll('[data-portal]').forEach(button=>button.addEventListener('click',()=>{if(!busy){portal=button.dataset.portal;$('#auth-error').hidden=true;renderAuth();}}));
$('#google-signin').addEventListener('click',async()=>{
 if(busy||!googleAvailable)return;busy=true;renderAuth();$('#auth-error').hidden=true;$('#google-signin span').textContent='Connecting to Google…';
 try{
  const clerk=await auth.ready;
  const callback=location.origin+'/login?portal='+portal+'&callback=1';
  await clerk.client.signIn.authenticateWithRedirect({strategy:'oauth_google',redirectUrl:callback,redirectUrlComplete:location.origin+'/login?portal='+portal+'&finish=1'});

 }catch(error){busy=false;renderAuth();$('#google-signin span').textContent='Continue with Google';showError(error.message);}
});
$('#profile-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;renderAuth();$('#auth-error').hidden=true;
 try{
  const response=await auth.fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(event.currentTarget)),role:portal})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not complete your profile. Try again.');
  location.replace('/'+result.role);
 }catch(error){busy=false;renderAuth();showError(error.message);}
});
$('#use-other-account').addEventListener('click',async()=>{
 if(busy)return;busy=true;renderAuth();
 try{await auth.signOut(portal);}
 catch(error){busy=false;renderAuth();showError(error.message);}
});
renderAuth();
(async()=>{
 try{
  const clerk=await auth.ready;const config=auth.config;googleAvailable=Boolean(clerk&&config.google);
  if(clerk&&isCallback){
   await clerk.handleRedirectCallback({signInForceRedirectUrl:'/login?portal='+portal+'&finish=1',signUpForceRedirectUrl:'/login?portal='+portal+'&finish=1',signInUrl:'/login?portal='+portal+'&continue=1',signUpUrl:'/login?portal='+portal+'&continue=1',continueSignUpUrl:'/login?portal='+portal+'&continue=1'});return;
  }
  if(clerk&&query.has('continue')){
   $('#clerk-continuation').hidden=false;$('#google-signin').hidden=true;$('#google-status').hidden=true;
   clerk.mountSignUp($('#clerk-continuation'),{routing:'hash',signInUrl:'/login',forceRedirectUrl:'/login?portal='+portal+'&finish=1'});return;
  }
  const sessionResponse=await auth.fetch('/api/auth/session');
  if(!sessionResponse.ok&&sessionResponse.status!==503)throw Error('Sign-in is temporarily unavailable. Refresh to try again.');
  const session=sessionResponse.ok?await sessionResponse.json():null;
  if(session?.user){
   if(['buyer','grower'].includes(session.user.role)){location.replace('/'+session.user.role);return;}
   onboarding=true;$('#google-identity').textContent='Signed in as '+session.user.name+' · '+session.user.email;
  }
  $('#google-status').textContent=googleAvailable?'Secure sign-in with your Google account.':'Google sign-in is not available yet. The site owner needs to finish connecting Google.';
  renderAuth();
  if(query.has('error'))showError('Google sign-in was cancelled or could not be completed. Please try again.');
 }catch(error){$('#google-status').textContent='Sign-in is temporarily unavailable.';showError(error.message);}
})();
