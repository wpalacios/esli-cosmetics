-- Create PostgreSQL sequence for transfer tracking numbers (12-digit display is applied in app)
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq START WITH 1;
