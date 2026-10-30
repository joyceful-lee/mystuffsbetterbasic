'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { authClient } from '../lib/auth-client';
type Mode='sign-in'|'sign-up'|'forgot'|'reset';
export default function AuthForm({initial='sign-up',token='',invalidLink=false,guestSummary,onContinueGuest}:{initial?:Mode;token?:string;invalidLink?:boolean;guestSummary?:{binders:number;cards:number};onContinueGuest?:()=>void}) {
 const [mode,setMode]=useState<Mode>(initial);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 function changeMode(next:Mode){setMode(next);setError('');setMessage('');}
 async function submit(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);
  try {
   const email=String(form.get('email')||'').trim();const password=String(form.get('password')||'');
   if(mode==='forgot'){
    const result=await authClient.requestPasswordReset({email,redirectTo:window.location.origin+'/reset-password'});
    if(result.error)throw new Error(result.error.message||'Could not request a reset link. Try again.');
    setMessage('If an account uses that email, a password reset link will arrive shortly. Check your inbox and spam folder.');setBusy(false);return;
   }
   if(mode==='reset'){
    if(!token||invalidLink)throw new Error('This reset link is invalid or has expired. Request a new one.');
    if(password!==String(form.get('confirmation')))throw new Error('Your passwords don’t match. Enter the same password in both fields.');
    const result=await authClient.resetPassword({newPassword:password,token});
    if(result.error)throw new Error(result.error.message||'This reset link could not be used. Request a new one.');
    setMode('sign-in');setMessage('Your password has been updated. You can log in with your new password.');setBusy(false);return;
   }
   const result=mode==='sign-up'?await authClient.signUp.email({email,password,name:String(form.get('name')),callbackURL:window.location.origin+'/'}):await authClient.signIn.email({email,password,callbackURL:window.location.origin+'/'});
   if(result.error)throw new Error(result.error.message||'Could not sign in. Try again.');
   const session=await authClient.getSession();
   if(!session.data?.user)throw new Error('Check your email to finish signing up, then sign in here. Your guest binder will be waiting.');
   window.location.href='/';
  }catch(e){setError(e instanceof Error?e.message:'Could not connect. Try again.');setBusy(false);}
 }
 const badLink=mode==='reset'&&(!token||invalidLink);
 return <><div className="auth-intro">{mode==='forgot'&&<h3>Forgot your password?</h3>}<p>{mode==='forgot'?'Enter your account email and we’ll send you a link to choose a new password.':mode==='reset'?'Choose a new password for your collection.':mode==='sign-up'?'Create an account to save your binders online and open them on another device.':'Log in to open your saved binders and continue adding cards.'}</p></div>
 {message&&<p className="auth-message" role="status">{message}</p>}
 {badLink?<p className="form-error" role="alert">This reset link is invalid or has expired. Request a new one below.</p>:<form key={mode} onSubmit={submit} className="stack-form">
 {mode==='sign-up'&&<label>Collector name<input name="name" required maxLength={40} placeholder="What should we call you?" autoComplete="nickname" disabled={busy}/></label>}
 {mode!=='reset'&&<label>Email<input name="email" type="email" required placeholder="you@example.com" autoComplete="email" disabled={busy}/></label>}
 {mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<input name="password" type="password" required minLength={8} maxLength={128} placeholder="At least 8 characters" autoComplete={mode==='sign-in'?'current-password':'new-password'} disabled={busy}/></label>}
 {mode==='reset'&&<label>Confirm new password<input name="confirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy}/></label>}
 {error&&<p role="alert" className="form-error">{error}</p>}<button className="button primary wide" disabled={busy}>{busy?'Please wait…':mode==='forgot'?'Send reset link':mode==='reset'?'Save new password':mode==='sign-up'?'Create my account':'Log in'}<ArrowRight size={17}/></button></form>}
 {mode==='sign-in'&&<button className="text-button" disabled={busy} onClick={()=>changeMode('forgot')}>Forgot password?</button>}
 {mode==='reset'&&<button className="text-button" disabled={busy} onClick={()=>changeMode('forgot')}>Request a new reset link</button>}
 {(mode==='sign-up'||mode==='sign-in')&&guestSummary&&<p className="guest-auth-note">{guestSummary.binders?`Your ${guestSummary.binders} guest ${guestSummary.binders===1?'binder':'binders'} and ${guestSummary.cards} ${guestSummary.cards===1?'card':'cards'} will move into your account after you sign in, alongside any binders already there. Your browser copy stays here until the upload finishes.`:'You can keep collecting as a guest and create an account whenever you are ready. An account lets you open your collection on other devices and share binder links.'}</p>}
 {(mode==='sign-up'||mode==='sign-in')&&onContinueGuest&&<button className="text-button" disabled={busy} onClick={onContinueGuest}>Continue as guest</button>}
 <button className="text-button" disabled={busy} onClick={()=>changeMode(mode==='sign-up'||mode==='forgot'||mode==='reset'?'sign-in':'sign-up')}>{mode==='sign-up'?'Already have an account? Log in':mode==='forgot'||mode==='reset'?'Back to log in':'New here? Create an account'}</button></>;
}
