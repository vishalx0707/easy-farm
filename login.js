const $=selector=>document.querySelector(selector);
const query=new URLSearchParams(location.search);
let portal=query.get('portal')==='grower'?'grower':'buyer';
let signup=query.get('mode')==='signup';
let busy=false;
function renderAuth(){
  const grower=portal==='grower';
  document.querySelectorAll('[data-portal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.portal===portal)));
  $('#portal-label').textContent=(grower?'GROWER':'BUYER')+' PORTAL';
  $('#auth-title').textContent=signup?(grower?'Your farm starts here.':'Better sourcing starts here.'):'Welcome back.';
  $('#auth-description').textContent=signup?(grower?'Create your grower account, introduce your farm and list your first harvest.':'Create a business buyer account to meet growers and start trading.'):(grower?'Sign in to manage your farm, harvest and incoming offers.':'Sign in to source produce and manage your purchases.');
  $('#registration-fields').hidden=!signup;
  $('#registration-fields').querySelectorAll('input').forEach(input=>input.disabled=!signup);
  $('#organization-label').textContent=grower?'Farm name':'Business name';
  $('#auth-submit').textContent=signup?'Create '+(grower?'grower':'buyer')+' account':'Sign in to '+(grower?'grower':'buyer')+' portal';
  $('#toggle-copy').textContent=signup?'Already have an account?':'New to EasyFarm?';
  $('#toggle-auth').textContent=signup?'Sign in':'Create an account';
  const password=$('[name="password"]');password.autocomplete=signup?'new-password':'current-password';password.minLength=signup?10:1;
  $('#password-hint').hidden=!signup;$('#auth-error').hidden=true;
  const url=new URL(location.href);url.searchParams.set('portal',portal);url.searchParams.set('mode',signup?'signup':'signin');history.replaceState(null,'',url);
  document.title=(grower?'Grower':'Buyer')+' portal · EasyFarm';
}
document.querySelectorAll('[data-portal]').forEach(button=>button.addEventListener('click',()=>{if(!busy){portal=button.dataset.portal;renderAuth();}}));
$('#toggle-auth').addEventListener('click',()=>{if(!busy){signup=!signup;renderAuth();}});
$('#show-password').addEventListener('click',()=>{const input=$('[name="password"]');const show=input.type==='password';input.type=show?'text':'password';$('#show-password').textContent=show?'Hide':'Show';$('#show-password').setAttribute('aria-label',show?'Hide password':'Show password');});
$('#auth-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;$('#auth-submit').disabled=true;$('#auth-error').hidden=true;
  $('#auth-submit').textContent=signup?'Creating your account…':'Signing in…';
  try{
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const body=signup?{...values,role:portal}:{email:values.email,password:values.password};
    const response=await fetch('/api/auth/'+(signup?'sign-up/email':'sign-in/email'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw Error(result.message||result.error||'Could not sign in. Try again.');
    location.replace('/'+(result.user.role==='grower'?'grower':'buyer'));
  }catch(error){renderAuth();$('#auth-error').textContent=error.message;$('#auth-error').hidden=false;}
  finally{busy=false;$('#auth-submit').disabled=false;}
});
renderAuth();
(async()=>{try{const session=await(await fetch('/api/auth/get-session')).json();if(session?.user)location.replace('/'+(session.user.role==='grower'?'grower':'buyer'));}catch{/* The form reports connection errors on submit. */}})();
