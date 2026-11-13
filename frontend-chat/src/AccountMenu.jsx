import React, { useContext } from 'react';
import { Popover } from '@base-ui/react/popover';
import { LogOut, Coins } from 'lucide-react';
import { AccountContext } from '@/lib/auth-config';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The signed-in person and their credits: a pill with their avatar and balance, opening a card with who they are,
 * what's left, what they've used it on, and sign out. Nothing shows when sign-in is off.
 */
export default function AccountMenu({ credits, className = '' }) {
  const account = useContext(AccountContext);
  if (!account) return null;
  const initial = (account.name || account.email || '?').trim().charAt(0).toUpperCase();
  const enforced = credits?.enforced;
  const balance = credits?.balance ?? 0;
  const granted = Math.max(credits?.granted ?? 0, balance + (credits?.used ?? 0), 1);
  const low = enforced && balance < 3;
  const use = credits?.usage ?? {};
  const avatar = account.imageUrl
    ? <img className="acct-avatar" src={account.imageUrl} alt="" referrerPolicy="no-referrer" />
    : <span className="acct-avatar" aria-hidden="true">{initial}</span>;

  return (
    <Popover.Root>
      <Popover.Trigger className={`acct-pill ${className}`} data-low={low || undefined}
        aria-label={`Your account${enforced ? `, ${plural(balance, 'credit', 'credits')} left` : ''}`}>
        {avatar}
        {enforced && <span className="acct-pill-credits"><Coins size={13} aria-hidden="true" />{balance}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={10} className="acct-positioner">
          <Popover.Popup className="acct-card">
            <div className="acct-who">
              {avatar}
              <div className="acct-id">
                <strong>{account.name || account.email}</strong>
                {account.name && account.email && <span>{account.email}</span>}
              </div>
            </div>
            {enforced ? (
              <div className="acct-credits">
                <p className="acct-balance" data-low={low || undefined}>
                  <strong>{balance}</strong>{balance === 1 ? 'credit left' : 'credits left'}
                </p>
                <div className="acct-meter" role="meter" aria-label="Credits left" aria-valuemin={0} aria-valuemax={granted} aria-valuenow={balance}>
                  <span style={{ width: `${Math.min(100, (balance / granted) * 100)}%` }} />
                </div>
                <p className="acct-note">
                  {use.analyses
                    ? `Used on ${plural(use.analyses, 'analysis', 'analyses')}${use.compare ? `, ${plural(use.compare, 'comparison', 'comparisons')} among them` : ''}. `
                    : 'Nothing used yet. '}
                  An analysis takes 1 credit per {credits.seconds_per_credit ?? 10} seconds of video, more for a bigger audience.
                  {low ? ' Running low? Ask the Rewire team for more.' : ''}
                </p>
              </div>
            ) : credits ? (
              <p className="acct-note">Credits aren’t counted on this server.</p>
            ) : (
              <p className="acct-note">Loading your credits…</p>
            )}
            <button type="button" className="acct-signout" onClick={account.signOut}><LogOut size={15} aria-hidden="true" />Sign out</button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
