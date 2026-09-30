-- Ensure CreditStatus enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditStatus') THEN
        CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAID', 'OVERDUE');
    END IF;
END $$;

-- Ensure CreditType enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditType') THEN
        CREATE TYPE "CreditType" AS ENUM ('SHORT_TERM', 'EMPLOYEE_CREDIT', 'PROMOTIONAL');
    END IF;
END $$;

-- Ensure PaymentFrequency enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentFrequency') THEN
        CREATE TYPE "PaymentFrequency" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY');
    END IF;
END $$;

-- Ensure CreditInstallmentStatus enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditInstallmentStatus') THEN
        CREATE TYPE "CreditInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');
    END IF;
END $$;
