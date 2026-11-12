import { createContext } from 'react';

/**
 * Sign-in settings, from Vite env (frontend/.env.local):
 *   VITE_CLERK_PUBLISHABLE_KEY  turns sign-in on (pk_test_... or pk_live_...); without it the app runs as one local user
 *   VITE_CLERK_GOOGLE=true      shows "Continue with Google" (enable Google in the Clerk dashboard first)
 */
export const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
export const AUTH_ENABLED = Boolean(CLERK_KEY);
export const GOOGLE_ENABLED = import.meta.env.VITE_CLERK_GOOGLE === 'true';

/** The signed-in person, for the header menu and workspace: { name, email, imageUrl, signOut }, or null when sign-in
 * is off. imageUrl is empty when they have no photo (an initial is shown instead). */
export const AccountContext = createContext(null);

/** Plain-language messages for the Clerk errors people actually hit. */
const MESSAGES = {
  form_identifier_not_found: 'This email isn’t on the beta list yet. Ask the Rewire team for an invitation.',
  not_allowed_access: 'This email isn’t on the beta list yet. Ask the Rewire team for an invitation.',
  sign_up_restricted_waitlist: 'Rewire is invite-only for now. Ask the Rewire team for an invitation.',
  form_param_format_invalid: 'Enter a valid email address.',
  form_code_incorrect: 'That code isn’t right. Check the latest email and try again.',
  verification_expired: 'That code has expired. Send a new one.',
  verification_failed: 'Too many attempts. Send a new code and try again.',
  too_many_requests: 'Too many attempts. Wait a minute, then try again.',
  form_identifier_exists: 'You already have an account. Sign in with your email instead.',
};

/** A readable message for any error from Clerk's hooks or calls. */
export function authMessage(error, fallback = 'Something went wrong. Try again.') {
  if (!error) return null;
  const first = error.errors?.[0] ?? error;
  return MESSAGES[first.code] ?? first.longMessage ?? first.message ?? fallback;
}

/** After Clerk finishes a sign-in: go to the app, using the URL Clerk decorates (it may need a full page load). */
export function finishNavigation({ decorateUrl }) {
  const url = decorateUrl('/');
  if (url.startsWith('http')) window.location.href = url;
  else window.history.replaceState(null, '', url);
}
