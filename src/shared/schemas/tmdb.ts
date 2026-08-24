import { z } from 'zod';

export const TmdbKeyInputSchema = z.object({
  key: z.string().min(10).max(64).regex(/^[a-f0-9]+$/i, 'Must be a valid TMDB API key'),
});

export type TmdbKeyInputParsed = z.infer<typeof TmdbKeyInputSchema>;
