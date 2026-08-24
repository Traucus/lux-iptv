import { z } from 'zod';

export const IngestStartInputSchema = z
  .object({
    source: z.enum(['xtream', 'm3u']),
    credentials: z
      .object({
        server: z.string().url(),
        username: z.string().min(1),
        password: z.string().min(1),
      })
      .optional(),
    url: z.string().url().optional(),
    listName: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.source === 'xtream') return data.credentials !== undefined;
      if (data.source === 'm3u') return data.url !== undefined;
      return false;
    },
    { message: 'credentials required for xtream, url required for m3u' },
  );

export type IngestStartInputParsed = z.infer<typeof IngestStartInputSchema>;

export const IngestProgressSchema = z.object({
  phase: z.string(),
  percent: z.number().min(0).max(100),
  counts: z.object({
    live: z.number(),
    movies: z.number(),
    series: z.number(),
    radio: z.number(),
    total: z.number(),
  }),
});

export const IngestCancelInputSchema = z.object({
  jobId: z.string().min(1),
});

export const IngestProgressInputSchema = z.object({
  jobId: z.string().min(1),
});
