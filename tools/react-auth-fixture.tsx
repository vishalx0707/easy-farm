// Compiled ONLY by `vite --mode fixtures` into the isolated test directory.
// Production imports @clerk/react directly and has no runtime auth bypass.
import {createContext,useContext,useState,useCallback,useMemo,type ReactNode} from 'react';
const Context=createContext<{token:string|null;setToken:(t:string|null)=>void}>({token:null,setToken:()=>{}});
export function ClerkProvider({children}:{children:ReactNode}){const [token,setToken]=useState(localStorage.getItem('qa_clerk_token'));return <Context.Provider value={{token,setToken}}>{children}</Context.Provider>;}
export function useAuth(){const {token}=useContext(Context);const getToken=useCallback(async()=>token,[token]);return useMemo(()=>({isLoaded:true,isSignedIn:!!token,userId:token?JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub:null,getToken}),[token,getToken]);}
export function useClerk(){const {setToken}=useContext(Context);return {async signOut({redirectUrl}:{redirectUrl:string}){setToken(null);localStorage.removeItem('qa_clerk_token');location.assign(redirectUrl);}};}
export function useSignIn(){return {signIn:{async sso(options:unknown){Object.assign(window,{ssoObserved:options});return {error:null};}}};}
export function HandleSSOCallback(props:unknown){Object.assign(window,{callbackObserved:{url:location.href,props}});return <div>Fixture provider return</div>;}
export function SignUp(){Object.assign(window,{continuationObserved:location.href});return <div>Fixture Google continuation</div>;}
export function SignIn(){return <div>Fixture Google sign-in continuation</div>;}
