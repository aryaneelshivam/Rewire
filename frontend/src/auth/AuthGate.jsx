import React, { useMemo } from 'react';
import { ClerkProvider, HandleSSOCallback, useAuth, useClerk, useUser } from '@clerk/react';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import App from '../App';
import SignInScreen from './SignInScreen';
import { setTokenGetter } from '../api';
import { AccountContext, AUTH_ENABLED, CLERK_KEY, finishNavigation } from '@/lib/auth-config';

function Splash({ label }) {
  return (
    <div className="splash">
      <h2>{label}</h2>
      <Skeleton lines={3} label={label} className="splash-skeleton" />
    </div>
  );
}

/** Where Google sends people back: Clerk completes the sign-in here, then the app loads. */
function SsoCallback() {
  const back = () => window.history.replaceState(null, '', '/');
  return (
    <>
      <Splash label="Signing you in" />
      <HandleSSOCallback navigateToApp={finishNavigation} navigateToSignIn={back} navigateToSignUp={back} />
    </>
  );
}

/** Signed in: the app, with every API request carrying this user's session token. Signed out: the sign-in screen. */
function Gate() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  // Registered during render so the app's first requests already carry the token.
  setTokenGetter(isSignedIn ? () => getToken() : null);

  const account = useMemo(() => (user ? {
    name: user.fullName || user.firstName || '',
    email: user.primaryEmailAddress?.emailAddress || '',
    signOut: () => clerk.signOut({ redirectUrl: '/' }),
  } : null), [user, clerk]);

  if (window.location.pathname === '/sso-callback') return <SsoCallback />;
  if (!isLoaded) return <Splash label="Loading" />;
  if (!isSignedIn) return <SignInScreen />;
  return (
    <AccountContext.Provider value={account}>
      {/* A new user gets a fresh app: nothing from the last person's session carries over. */}
      <App key={userId} />
    </AccountContext.Provider>
  );
}

/** The app behind Clerk sign-in when a publishable key is set; otherwise the app as before, for one local user. */
export default function Root() {
  if (!AUTH_ENABLED) return <App />;
  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <Gate />
    </ClerkProvider>
  );
}
