/**
 * PortalCredentialsDialog — shown once after a customer is created or linked.
 *
 * The generated password is never persisted in readable form, so this dialog is
 * the only place it is ever displayed. It also covers the two cases where there
 * is nothing to reveal: an existing login that was linked, and a customer saved
 * without portal access.
 */
import { CheckCircle, Link2, UserX } from 'lucide-react';
import type { CustomerCreateResult } from '../../lib/customers';

export default function PortalCredentialsDialog({
  result, onClose,
}: {
  result: CustomerCreateResult;
  onClose: () => void;
}) {
  const { customer, portalUser, linkage, password } = result;

  const icon = linkage === 'NONE' ? <UserX size={24} />
    : linkage === 'LINKED' ? <Link2 size={24} />
    : <CheckCircle size={24} />;

  const heading = linkage === 'NONE' ? 'Customer Created'
    : linkage === 'LINKED' ? 'Linked to Existing Login'
    : 'Account Created';

  const blurb = linkage === 'NONE'
    ? `"${customer.name}" was saved without a portal login. You can add one later from the admin Customers tab.`
    : linkage === 'LINKED'
      ? `"${customer.name}" is now linked to the existing portal login below. Its current password is unchanged.`
      : password
        ? 'Share these credentials with the customer so they can log into the portal. The password is shown only this once.'
        : 'The portal login below was created with the password you chose.';

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-canvas border border-hairline rounded-lg p-6 w-full max-w-sm shadow-lg text-center">
        <div className="mx-auto w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">{icon}</div>
        <h3 className="text-lg font-bold text-ink mb-2">{heading}</h3>
        <p className="text-sm text-subtle mb-4">{blurb}</p>

        {portalUser && (
          <div className="bg-soft border border-hairline rounded p-3 text-left space-y-2 text-sm font-mono text-ink mb-6 break-all">
            <p>Email: {portalUser.email}</p>
            {password && <p>Pass:  {password}</p>}
          </div>
        )}

        <button onClick={onClose} className="w-full py-2.5 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink-active">
          Done
        </button>
      </div>
    </div>
  );
}
