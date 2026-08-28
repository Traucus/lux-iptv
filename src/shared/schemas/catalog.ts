import { z } from 'zod';

export const CatalogListInputSchema = z.object({
  type: z.enum(['live', 'movie', 'series']),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  search: z.string().optional(),
  groupTitle: z.string().optional(),
});

export type CatalogListInputParsed = z.infer<typeof CatalogListInputSchema>;

export const CatalogGetByIdInputSchema = z.object({
  type: z.enum(['live', 'movie', 'series']),
  id: z.number().int().positive(),
});

export type CatalogGetByIdInputParsed = z.infer<typeof CatalogGetByIdInputSchema>;
