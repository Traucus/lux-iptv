import { z } from 'zod';

/**
 * Zod schemas for player IPC channel inputs. These are the single source of
 * truth shared between the main process (handler validation) and the preload
 * (typed call signatures). The renderer should never construct these
 * payloads directly — it imports the inferred TypeScript types instead.
 */

const ContentTypeSchema = z.enum(['live', 'movie', 'series', 'episode']);

/**
 * `player:getSource` input — identifies a catalog row to resolve a stream for.
 * The main process looks up the row, constructs a `PlaybackSource` (URL +
 * headers + media format), and returns it. The renderer never touches the
 * raw origin URL; the proxy is the only outbound path.
 */
export const PlayerGetSourceInputSchema = z.object({
  type: ContentTypeSchema,
  id: z.number().int().positive(),
});

export type PlayerGetSourceInputParsed = z.infer<typeof PlayerGetSourceInputSchema>;

/**
 * `player:reportError` input — used by the renderer to report non-fatal
 * playback problems (manifest stalls, decode warnings, etc.) back to main.
 * Main logs the error with the catalog context for diagnostics. There is no
 * persistence in this slice — that lives in the analytics slice (post-MVP).
 */
export const PlayerReportErrorInputSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(1024),
  ctx: z.record(z.unknown()).optional(),
});

export type PlayerReportErrorInputParsed = z.infer<typeof PlayerReportErrorInputSchema>;

/**
 * `player:reportProgress` input — used by the renderer to forward resume
 * position updates to main. Main currently logs only; persistence lands in
 * the VOD Resume slice (renderer-side IndexedDB).
 */
export const PlayerReportProgressInputSchema = z.object({
  type: ContentTypeSchema,
  id: z.number().int().positive(),
  position: z.number().min(0),
  duration: z.number().min(0),
});

export type PlayerReportProgressInputParsed = z.infer<typeof PlayerReportProgressInputSchema>;

/**
 * `player:getNextEpisode` input — given the current episode, return the next
 * episode in series order (same season first; cross-season when at the end).
 */
export const PlayerGetNextEpisodeInputSchema = z.object({
  episodeId: z.number().int().positive(),
});

export type PlayerGetNextEpisodeInputParsed = z.infer<typeof PlayerGetNextEpisodeInputSchema>;

/**
 * `player:getProxiedUrl` input — used by the renderer to resolve the proxied
 * URL for a given catalog row. Main returns the absolute URL on the in-process
 * stream proxy (see G5 for the proxy itself). Until G5 lands, this returns a
 * `NOT_IMPLEMENTED` error from the handler.
 */
export const PlayerGetProxiedUrlInputSchema = z.object({
  type: ContentTypeSchema,
  id: z.number().int().positive(),
});

export type PlayerGetProxiedUrlInputParsed = z.infer<typeof PlayerGetProxiedUrlInputSchema>;
