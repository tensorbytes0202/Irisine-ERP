'use client';

import { useState } from 'react';

export interface LoginLink {
  name: string;
  link: string;
  emailSent: boolean;
}

/** The one-time "set your password" link a school hands to a student. */
export function LoginLinkBox({ name, link, emailSent, onClose }: LoginLink & { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {} // clipboard blocked: the link is on screen and can be selected by hand
  }

  return (
    <div role="status" className="mb-4 rounded-lg border bg-card p-4 space-y-2 text-sm">
      <p className="font-semibold">Login link for {name}</p>
      <p className="text-muted-foreground">
        {emailSent ? 'It was also emailed to the student. ' : 'Email could not be sent, so send this link yourself. '}
        The student opens it, sets a password, then signs in with the Student card. It works once, for 72 hours.
      </p>
      <p className="break-all rounded-md border bg-muted p-2">{link}</p>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">{copied ? 'Copied' : 'Copy link'}</button>
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5">Close</button>
      </div>
    </div>
  );
}
