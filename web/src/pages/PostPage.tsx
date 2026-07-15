import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ListingForm from '../components/ListingForm';
import { createListing } from '../api/listings';
import { useMe } from '../api/session';
import type { CreateListingInput, ListingType, UpdateListingInput } from '../api/types';

function parseType(value: string | null): ListingType | undefined {
  return value === 'driver' || value === 'rider' ? value : undefined;
}

export default function PostPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const needsContact = !me?.email && !me?.phone;

  function handleSubmit(input: CreateListingInput | UpdateListingInput): void {
    createListing(queryClient, input as CreateListingInput);
    navigate('/', { replace: true });
  }

  return (
    <div className="form-page">
      <h1>Post a ride</h1>
      <p className="form-page-subtext">
        No account needed — posting creates your private session automatically.
      </p>
      <ListingForm
        mode="create"
        initialType={parseType(searchParams.get('type'))}
        needsContact={needsContact}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
