-- How a user prefers to be texted when they share their number: the links in
-- message contact blocks respect this ('sms' → sms:, 'whatsapp' → wa.me).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_contact_pref text NOT NULL DEFAULT 'sms';
