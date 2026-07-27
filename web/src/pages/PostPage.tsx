import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ListingForm from '../components/ListingForm';
import { createListing } from '../api/listings';
import { useMe } from '../api/session';
import { onOutboxFailure } from '../offline/outbox';
import type { CreateListingInput, Direction, ListingType, UpdateListingInput } from '../api/types';

function parseType(value: string | null): ListingType | undefined {
  return value === 'driver' || value === 'rider' ? value : undefined;
}

function parseDirection(value: string | null): Direction | undefined {
  return value === 'to_brc' || value === 'from_brc' ? value : undefined;
}

function friendlyRejection(code: string): string {
  switch (code) {
    case 'daily_limit':
      return 'You’ve hit the daily posting limit — try again tomorrow.';
    case 'active_limit':
      return 'You already have the maximum active listings in this direction — cancel or edit one from the You page first.';
    case 'invalid_phone':
      return 'That phone number doesn’t look right — fix it and post again.';
    case 'date_out_of_range':
      return 'That travel date is outside the posting window — double-check the year.';
    default:
      return 'Your post was rejected by the server — double-check the fields and try again.';
  }
}

export default function PostPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const [emailRequired, setEmailRequired] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  // Posting needs an email now, so ask whenever the account hasn't got one — a
  // phone on file no longer satisfies the server.
  const needsContact = !me?.email;

  async function handleSubmit(input: CreateListingInput | UpdateListingInput): Promise<void> {
    const listing = input as CreateListingInput;
    setEmailTaken(null);
    setEmailRequired(false);
    setRejection(null);

    // The POST rides the offline outbox, so a rejection surfaces as an outbox
    // failure rather than a throw. Watch for this listing's own failure while the
    // flush runs; anything else (offline included) leaves the post queued and we
    // navigate as before.
    let taken = false;
    let missingEmail = false;
    let rejectedCode: string | null = null;
    const stopWatching = onOutboxFailure((failure) => {
      const body = failure.item.body as CreateListingInput | undefined;
      if (body?.clientId !== listing.clientId) return;
      if (failure.status === 409 && failure.code === 'email_taken') taken = true;
      else if (failure.status === 400 && failure.code === 'email_required') missingEmail = true;
      else rejectedCode = failure.code;
    });
    try {
      await createListing(queryClient, listing);
    } finally {
      stopWatching();
    }

    if (taken) {
      setEmailTaken(listing.contact?.email ?? '');
      return;
    }
    if (missingEmail) {
      setEmailRequired(true);
      return;
    }
    if (rejectedCode) {
      // Stay on the form with everything as typed — navigating away would make
      // the post look accepted while it silently vanished.
      setRejection(friendlyRejection(rejectedCode));
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="form-page">
      <div className="form-page-header">
        <h1>Create a post</h1>
        <p className="form-page-subtext">
          No account needed — posting creates your private session automatically.
        </p>
      </div>
      {rejection && (
        <p className="form-note form-note--error" role="alert">
          {rejection}
        </p>
      )}
      <ListingForm
        mode="create"
        initialType={parseType(searchParams.get('type'))}
        initialDirection={parseDirection(searchParams.get('direction'))}
        needsContact={needsContact}
        emailTaken={emailTaken}
        emailRequired={emailRequired}
        onSubmit={(input) => void handleSubmit(input)}
      />
    </div>
  );
}
