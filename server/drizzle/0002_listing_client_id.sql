ALTER TABLE listings ADD COLUMN client_id uuid;
CREATE UNIQUE INDEX listings_client_id_idx ON listings (client_id) WHERE client_id IS NOT NULL;
