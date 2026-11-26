import {createClerkClient} from '@clerk/backend';

export function createAuth(config, providedClient) {
  const publishableKey=config.CLERK_PUBLISHABLE_KEY||config.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||'';
  const secretKey=config.CLERK_SECRET_KEY||'';
  const configured=Boolean(publishableKey&&secretKey);
  const client=providedClient||(configured?createClerkClient({publishableKey,secretKey,jwtKey:config.CLERK_JWT_KEY}):null);
  return {
    configured,
    publicConfig:{provider:'clerk',publishableKey,google:configured},
    async identity(request){
      if(!configured)return null;
      // API traffic uses the SDK's short-lived session token, not a user ID,
      // metadata role, legacy cookie or browser-provided profile.
      if(!request.headers.get('Authorization')?.startsWith('Bearer '))return null;
      const origin=new URL(request.url).origin;
      const state=await client.authenticateRequest(request,{authorizedParties:[origin],acceptsToken:'session_token'});
      if(!state.isAuthenticated)return null;
      const {userId,sessionId}=state.toAuth();
      if(!userId||!sessionId)return null;
      const [user,session]=await Promise.all([client.users.getUser(userId),client.sessions.getSession(sessionId)]);
      if(session.status!=='active'||session.userId!==userId)return null;
      const google=user.externalAccounts.find(account=>account.provider==='oauth_google');
      const primary=user.emailAddresses.find(email=>email.id===user.primaryEmailAddressId);
      if(!google||primary?.verification?.status!=='verified')return null;
      return {clerkId:user.id,email:primary.emailAddress.toLowerCase(),name:[user.firstName,user.lastName].filter(Boolean).join(' ')||user.username||'EasyFarm member',googleSubject:google.providerUserId};
    }
  };
}
