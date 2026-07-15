ALTER TABLE messages ADD COLUMN client_id uuid;
CREATE UNIQUE INDEX messages_client_id_idx ON messages (client_id) WHERE client_id IS NOT NULL;
