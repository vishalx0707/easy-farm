// Clerk's browser SDK owns the OAuth flow and refreshes short-lived API tokens.
window.EasyFarmAuth=(()=>{
 let config;
 const ready=(async()=>{
  const response=await fetch('/api/auth-config');if(!response.ok)throw Error('Sign-in is temporarily unavailable.');config=await response.json();
  if(!config.google||!config.publishableKey)return null;
  let host;try{host=atob(config.publishableKey.split('_').slice(2).join('_')).replace(/\$$/,'');}catch{throw Error('Sign-in configuration is invalid.');}
  if(!/^[a-z0-9.-]+$/i.test(host))throw Error('Sign-in configuration is invalid.');
  if(!window.Clerk)await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.dataset.clerkPublishableKey=config.publishableKey;
   script.src='https://'+host+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js';script.onload=resolve;script.onerror=()=>reject(Error('Could not load secure sign-in. Check your connection and retry.'));document.head.appendChild(script);
  });
  await window.Clerk.load({signInUrl:'/login',signUpUrl:'/login?continue=1',signInFallbackRedirectUrl:'/login',signUpFallbackRedirectUrl:'/login'});
  return window.Clerk;
 })();
 // Avoid an unhandled rejection on public trace pages that don't require login.
 ready.catch(()=>{});
 async function authorizedFetch(input,init={}){
  const clerk=await ready;const headers=new Headers(init.headers);const token=await clerk?.session?.getToken();if(token)headers.set('Authorization','Bearer '+token);
  return fetch(input,{...init,headers});
 }
 return {ready,fetch:authorizedFetch,get config(){return config;},async signOut(portal){const clerk=await ready;if(clerk)await clerk.signOut({redirectUrl:'/login?portal='+portal});else location.replace('/login?portal='+portal);}};
})();
