-- Create PostgreSQL sequences for order_number and quote_number (12-digit display is applied in app)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 1;

-- Remove the previous table-based approach
DROP TABLE IF EXISTS number_sequences;
