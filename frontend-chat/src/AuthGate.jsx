import React, { useEffect, useMemo } from 'react';
import { ClerkProvider, HandleSSOCallback, useAuth, useClerk, useUser } from '@clerk/react';
import SignInScreen from '@/auth/SignInScreen';
import { AccountContext, AUTH_ENABLED, CLERK_KEY, finishNavigation } from '@/lib/auth-config';
import { setAccountEmail, setTokenGetter } from './api';
import Peek from './Peek';
import App from './App';

/**
 * Sign-in, shared with the dashboard: the same Clerk app, the same invite-only email-code flow (the dashboard's
 * SignInScreen), shown here on the Aura gradient with Peek. With no publishable key the app runs as one local user.
 */

function useAura() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.look = 'aura'; root.dataset.theme = 'light'; root.dataset.accent = 'orange';
  }, []);
}

function Splash({ label }) {
  useAura();
  return (
    <div className="chat-auth" aria-busy="true">
      <Peek state="thinking" size={120} intro={false} />
      <p className="chat-auth-wait">{label}</p>
    </div>
  );
}

/** Where Google sends people back: Clerk completes the sign-in, then the app loads. */
function SsoCallback() {
  const back = () => window.history.replaceState(null, '', '/');
  return (
    <>
      <Splash label="Signing you in…" />
      <HandleSSOCallback navigateToApp={finishNavigation} navigateToSignIn={back} navigateToSignUp={back} />
    </>
  );
}

function SignIn() {
  useAura();
  return (
    <div className="chat-auth">
      <Peek state="idle" size={120} />
      <div className="chat-auth-card"><SignInScreen /></div>
    </div>
  );
}

/** Signed in: the app, every request carrying this person's session token. Signed out: the sign-in screen. */
function Gate() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  // Set during render so the app's first requests already carry the token.
  setTokenGetter(isSignedIn ? () => getToken() : null);
  setAccountEmail(isSignedIn ? user?.primaryEmailAddress?.emailAddress : '');

  const account = useMemo(() => (user ? {
    name: user.fullName || user.firstName || '',
    email: user.primaryEmailAddress?.emailAddress || '',
    imageUrl: user.hasImage ? user.imageUrl : '',
    signOut: () => clerk.signOut({ redirectUrl: '/' }),
  } : null), [user, clerk]);

  if (window.location.pathname === '/sso-callback') return <SsoCallback />;
  if (!isLoaded) return <Splash label="Loading…" />;
  if (!isSignedIn) return <SignIn />;
  return (
    <AccountContext.Provider value={account}>
      {/* A different person gets a fresh app: nothing from the last session carries over. */}
      <App key={userId} />
    </AccountContext.Provider>
  );
}

export default function Root() {
  if (!AUTH_ENABLED) return <App />;
  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <Gate />
    </ClerkProvider>
  );
}
