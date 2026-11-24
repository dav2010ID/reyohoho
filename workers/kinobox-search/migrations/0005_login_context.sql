-- The bot shows where a login request came from, so a forwarded (phishing)
-- request stands out. Coarse values only: browser/OS and Cloudflare's country/city.
ALTER TABLE tg_login ADD COLUMN request_device TEXT;
ALTER TABLE tg_login ADD COLUMN request_place TEXT;
