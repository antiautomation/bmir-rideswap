import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ListingForm from '../components/ListingForm';
import { createListing } from '../api/listings';
import { useMe } from '../api/session';
import { onOutboxFailure } from '../offline/outbox';
import type { CreateListingInput, ListingType, UpdateListingInput } from '../api/types';

function parseType(value: string | null): ListingType | undefined {
  return value === 'driver' || value === 'rider' ? value : undefined;
}

export default function PostPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [emailTaken, setEmailTaken] = useState<string | null>(null);

  const needsContact = !me?.email && !me?.phone;

  async function handleSubmit(input: CreateListingInput | UpdateListingInput): Promise<void> {
    const listing = input as CreateListingInput;
    setEmailTaken(null);

    // The POST rides the offline outbox, so a rejection surfaces as an outbox
    // failure rather than a throw. Watch for this listing's own failure while the
    // flush runs; anything else (offline included) leaves the post queued and we
    // navigate as before.
    let taken = false;
    const stopWatching = onOutboxFailure((failure) => {
      const body = failure.item.body as CreateListingInput | undefined;
      if (body?.clientId !== listing.clientId) return;
      if (failure.status === 409 && failure.code === 'email_taken') taken = true;
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
    navigate('/', { replace: true });
  }

  return (
    <div className="form-page">
      <div className="form-page-header">
        <h1>Post a ride</h1>
        <p className="form-page-subtext">
          No account needed — posting creates your private session automatically.
        </p>
      </div>
      <ListingForm
        mode="create"
        initialType={parseType(searchParams.get('type'))}
        needsContact={needsContact}
        emailTaken={emailTaken}
        onSubmit={(input) => void handleSubmit(input)}
      />
    </div>
  );
}
