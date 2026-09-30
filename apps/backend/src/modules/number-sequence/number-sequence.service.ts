import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  NUMBER_SEQUENCE_DIGITS,
  type NumberSequenceSchemaName,
} from "./number-sequence.constants";

export type NumberSequenceTx = Prisma.TransactionClient;

/** PostgreSQL sequence names (identifiers, not user input). */
const SEQUENCE_NAMES: Record<NumberSequenceSchemaName, string> = {
  orders: "order_number_seq",
  quotes: "quote_number_seq",
  transfers: "transfer_number_seq",
};

/**
 * Allocates the next number using PostgreSQL SEQUENCE. Formatted as 12-digit
 * zero-padded string for readability (e.g. "000000000001", "000000000012").
 * Note: nextval() is not rolled back on transaction failure, so gaps may occur.
 */
@Injectable()
export class NumberSequenceService {
  private readonly logger = new Logger(NumberSequenceService.name);

  /**
   * Returns the next number for the given schema, formatted as a 12-digit
   * zero-padded string for user-facing display and easy reading.
   */
  async getNextNumber(
    tx: NumberSequenceTx,
    schemaName: NumberSequenceSchemaName
  ): Promise<string> {
    const sequenceName = SEQUENCE_NAMES[schemaName];
    // Sequence names are fixed identifiers (orders/quotes/transfers only), not user input. Cast to regclass for nextval().
    const rows = await tx.$queryRawUnsafe<[{ nextval: string }]>(
      `SELECT nextval($1::regclass) AS nextval`,
      sequenceName
    );

    const nextValue = Number(rows[0].nextval);
    const formatted = nextValue
      .toString()
      .padStart(NUMBER_SEQUENCE_DIGITS, "0");
    this.logger.debug(
      `[NumberSequence] Allocated ${schemaName} number: ${formatted}`
    );
    return formatted;
  }
}
