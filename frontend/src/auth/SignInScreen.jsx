import React, { useEffect, useRef, useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/react';
import { Button } from '@/components/arc/button/button';
import { Input } from '@/components/arc/input/input';
import { Alert } from '@/components/arc/alert/alert';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { authMessage, finishNavigation, GOOGLE_ENABLED } from '@/lib/auth-config';

const RESEND_AFTER_S = 30;   // Clerk's minimum wait between codes

/** Reads and clears an invitation from the URL (Clerk adds __clerk_ticket and __clerk_status to invite links). */
function takeInvitation() {
  const params = new URLSearchParams(window.location.search);
  const ticket = params.get('__clerk_ticket');
  if (!ticket) return null;
  const status = params.get('__clerk_status');
  params.delete('__clerk_ticket');
  params.delete('__clerk_status');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  return { ticket, status };
}

// Read once, when the page loads with an invitation link, and cleared from the address bar straight away.
const INVITATION = takeInvitation();
const pendingInvite = INVITATION && INVITATION.status !== 'complete' ? INVITATION : null;

/**
 * Sign-in for the invite-only beta, built on Clerk's hooks:
 *   email   -> a 6-digit code by email -> signed in
 *   invite  -> an invitation link signs the person up and in; a name is asked for only if Clerk requires one
 *   Google  -> optional (VITE_CLERK_GOOGLE=true), through /sso-callback
 * Accounts are created only from invitations; an email that was not invited is told so.
 */
export default function SignInScreen() {
  const { signIn, fetchStatus: signInFetch } = useSignIn();
  const { signUp, fetchStatus: signUpFetch } = useSignUp();
  const [step, setStep] = useState(pendingInvite ? 'invite' : 'email');   // email | code | invite | details
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [names, setNames] = useState({ firstName: '', lastName: '' });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(INVITATION?.status === 'complete' ? 'Your invitation was already accepted. Sign in with your email.' : null);
  const [wait, setWait] = useState(0);
  const accepting = useRef(false);
  const busy = signInFetch === 'fetching' || signUpFetch === 'fetching' || step === 'invite';

  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  // An invitation link: accept it once (the ref survives StrictMode's double effect).
  useEffect(() => {
    if (!pendingInvite || accepting.current || !signIn || !signUp) return;
    accepting.current = true;
    const invite = pendingInvite;
    (async () => {
      if (invite.status === 'sign_in') {
        const { error: e } = await signIn.ticket({ ticket: invite.ticket });
        if (e) { setError(authMessage(e)); setStep('email'); return; }
        if (signIn.status === 'complete') { await signIn.finalize({ navigate: finishNavigation }); return; }
      } else {
        const { error: e } = await signUp.ticket({ ticket: invite.ticket });
        if (e) { setError(authMessage(e)); setStep('email'); return; }
        if (signUp.status === 'complete') { await signUp.finalize({ navigate: finishNavigation }); return; }
        if (signUp.missingFields?.every(f => f === 'first_name' || f === 'last_name')) { setStep('details'); return; }
      }
      setError('This invitation needs details this screen can’t collect. Ask the Rewire team to check the sign-up settings.');
      setStep('email');
    })();
  }, [signIn, signUp]);

  const sendCode = async event => {
    event?.preventDefault();
    setError(null);
    setNotice(null);
    const address = email.trim();
    if (!address) { setError('Enter your email address.'); return; }
    const { error: e } = await signIn.emailCode.sendCode({ emailAddress: address });
    if (e) { setError(authMessage(e)); return; }
    setStep('code');
    setCode('');
    setWait(RESEND_AFTER_S);
  };

  const resend = async () => {
    setError(null);
    const { error: e } = await signIn.emailCode.sendCode();
    if (e) { setError(authMessage(e)); return; }
    setNotice(`A new code is on its way to ${email.trim()}.`);
    setWait(RESEND_AFTER_S);
  };

  const verify = async event => {
    event.preventDefault();
    setError(null);
    const { error: e } = await signIn.emailCode.verifyCode({ code: code.trim() });
    if (e) { setError(authMessage(e)); return; }
    if (signIn.status === 'complete') { await signIn.finalize({ navigate: finishNavigation }); return; }
    setError(signIn.status === 'needs_second_factor'
      ? 'This account uses two-step verification, which the beta doesn’t support yet. Ask the Rewire team to turn it off for you.'
      : 'Sign-in couldn’t be completed. Send a new code and try again.');
  };

  const saveDetails = async event => {
    event.preventDefault();
    setError(null);
    const { error: e } = await signUp.update({ firstName: names.firstName.trim(), lastName: names.lastName.trim() });
    if (e) { setError(authMessage(e)); return; }
    if (signUp.status === 'complete') { await signUp.finalize({ navigate: finishNavigation }); return; }
    setError('Your account couldn’t be finished. Ask the Rewire team for a new invitation.');
  };

  const google = async () => {
    setError(null);
    const { error: e } = await signIn.sso({ strategy: 'oauth_google', redirectUrl: '/', redirectCallbackUrl: '/sso-callback' });
    if (e) setError(authMessage(e));
  };

  const missing = signUp?.missingFields ?? [];

  return (
    <main className="onboard auth">
      <div className="onboard-inner auth-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head">
          <h1>{step === 'code' ? 'Check your email' : step === 'details' ? 'Finish your account' : 'Sign in to Rewire'}</h1>
          <p className="onboard-lede">
            {step === 'code'
              ? <>We sent a 6-digit code to <strong>{email.trim()}</strong>. It works for 10 minutes.</>
              : step === 'details'
                ? 'One last thing before your workspace opens.'
                : 'Rewire is in private beta. Sign in with the email your invitation was sent to.'}
          </p>
        </header>

        {error && <Alert tone="danger" title="Couldn’t sign in" onDismiss={() => setError(null)}>{error}</Alert>}
        {notice && !error && <Alert tone="info" onDismiss={() => setNotice(null)}>{notice}</Alert>}

        {step === 'invite' && <Skeleton lines={2} label="Accepting your invitation" />}

        {step === 'email' && (
          <form className="auth-form" onSubmit={sendCode} noValidate>
            <Input label="Work email" type="email" autoComplete="email" inputMode="email" autoFocus value={email}
              onChange={e => setEmail(e.target.value)} disabled={busy} />
            <Button type="submit" loading={busy} disabled={!signIn}>Email me a code</Button>
            {GOOGLE_ENABLED && (
              <>
                <p className="auth-or" aria-hidden="true"><span>or</span></p>
                <Button type="button" variant="secondary" onClick={google} disabled={busy || !signIn}>Continue with Google</Button>
              </>
            )}
          </form>
        )}

        {step === 'code' && (
          <form className="auth-form" onSubmit={verify} noValidate>
            <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} />
            <Button type="submit" loading={busy} disabled={code.length < 6}>Sign in</Button>
            <div className="auth-links">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setStep('email'); setError(null); setNotice(null); }}>Use a different email</Button>
              <Button type="button" variant="ghost" size="sm" onClick={resend} disabled={wait > 0 || busy}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</Button>
            </div>
          </form>
        )}

        {step === 'details' && (
          <form className="auth-form" onSubmit={saveDetails} noValidate>
            {missing.includes('first_name') && <Input label="First name" autoComplete="given-name" autoFocus value={names.firstName} onChange={e => setNames(n => ({ ...n, firstName: e.target.value }))} disabled={busy} />}
            {missing.includes('last_name') && <Input label="Last name" autoComplete="family-name" value={names.lastName} onChange={e => setNames(n => ({ ...n, lastName: e.target.value }))} disabled={busy} />}
            <Button type="submit" loading={busy}>Open my workspace</Button>
          </form>
        )}

        <p className="auth-foot">No invitation yet? Rewire is invite-only while in beta. Ask the Rewire team for access.</p>
        {/* Clerk's bot protection renders here when it needs to. */}
        <div id="clerk-captcha" />
      </div>
    </main>
  );
}
