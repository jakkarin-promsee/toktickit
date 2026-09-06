const MIN_SEQUENCE = 1;
const MAX_SEQUENCE = 999_999;
const DEFAULT_MAX_ATTEMPTS = 20;

export function formatTicketNumber(date: Date, sequence: number): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Ticket Number date must be valid.");
  }

  if (
    !Number.isInteger(sequence) ||
    sequence < MIN_SEQUENCE ||
    sequence > MAX_SEQUENCE
  ) {
    throw new RangeError(
      `Ticket Number sequence must be an integer from ${MIN_SEQUENCE} to ${MAX_SEQUENCE}.`
    );
  }

  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const paddedSequence = sequence.toString().padStart(6, "0");

  return `TKT-${year}${month}${day}-${paddedSequence}`;
}

type FindAvailableTicketNumberOptions = {
  date: Date;
  startingSequence: number;
  isAvailable: (ticketNumber: string) => Promise<boolean>;
  maxAttempts?: number;
};

export async function findAvailableTicketNumber({
  date,
  startingSequence,
  isAvailable,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: FindAvailableTicketNumberOptions): Promise<string> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer.");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sequence = startingSequence + attempt;

    if (sequence > MAX_SEQUENCE) {
      break;
    }

    const candidate = formatTicketNumber(date, sequence);
    if (await isAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate a unique Ticket Number.");
}
