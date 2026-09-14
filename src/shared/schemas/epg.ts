import { z } from 'zod';

export const EpgNowNextInputSchema = z.object({
  channelIds: z.array(z.number().int().positive()).max(50),
});

export type EpgNowNextInputParsed = z.infer<typeof EpgNowNextInputSchema>;
