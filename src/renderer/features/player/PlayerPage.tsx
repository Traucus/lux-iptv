import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '../../components/organisms/VideoPlayer';
import { getPosition, createPositionThrottler } from '../../db/playback-resume';
import { Season } from './next-episode';
import type { Episode, CatalogItem } from '../../../shared/types/ipc';
import { createLuxAPI } from '../../lib/api';
import { Button } from '../../components/atoms/Button';

/**
 * PlayerPage — Route handler for `/watch/:type/:id`.
 *
 * Design §7.10:
 * - URL params → catalog query → source resolution → VideoPlayer
 * - live vs VOD branching
 * - ResumeDialog for VOD content
 */

interface PlaybackSource {
  url: string;
  mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
  httpHeaders?: Record<string, string>;
  type: 'live' | 'movie' | 'episode';
}

interface ResumeDialogProps {
  position: number;
  duration: number;
  onResume: () => void;
  onRestart: () => void;
}

const ResumeDialog: React.FC<ResumeDialogProps> = ({ position, duration, onResume, onRestart }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.9)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'rgba(20,20,30,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '1.5rem', color: '#fff' }}>
          Resume Playback?
        </h2>
        <p style={{ margin: '0 0 24px', color: '#ccc', fontSize: '1rem' }}>
          You watched up to <strong>{formatTime(position)}</strong> of <strong>{formatTime(duration)}</strong>
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Button
            variant="glass"
            size="lg"
            onClick={onRestart}
            style={{ flex: 1 }}
          >
            Restart
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onResume}
            style={{ flex: 1 }}
          >
            Resume from {formatTime(position)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const PlayerPage: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const contentType = type as 'live' | 'movie' | 'series' | 'episode';
  const contentId = parseInt(id ?? '0', 10);

  const [playbackSource, setPlaybackSource] = useState<PlaybackSource | null>(null);
  const [proxyError, setProxyError] = useState(false);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  // Validate content type
  useEffect(() => {
    const validTypes: Array<'live' | 'movie' | 'series' | 'episode'> = ['live', 'movie', 'series', 'episode'];
    if (!validTypes.includes(contentType)) {
      navigate('/');
    }
  }, [contentType, navigate]);

  // Fetch catalog item
  const { data: catalogItem, isLoading, error } = useQuery({
    queryKey: ['playback-source', contentType, contentId],
    queryFn: async () => {
      const luxAPI = createLuxAPI();
      const result = await luxAPI.catalog.getById({ type: contentType, id: contentId });
      if (result.error) throw new Error(result.error.message);
      return result.data as CatalogItem | { series: CatalogItem; seasons: Season[] };
    },
    enabled: !!contentId && ['live', 'movie', 'series', 'episode'].includes(contentType),
    retry: false,
  });

  // Resolve playback src only from player:getProxiedUrl (never origin).
  useEffect(() => {
    if (!catalogItem) return;
    let cancelled = false;
    setProxyError(false);

    (async () => {
      const luxAPI = createLuxAPI();
      let playType: 'live' | 'movie' | 'episode' =
        contentType === 'live' ? 'live' : contentType === 'movie' ? 'movie' : 'episode';
      let playId = contentId;

      if (contentType === 'series') {
        const seriesData = catalogItem as { series: CatalogItem; seasons: Season[] };
        const firstEpisode = seriesData.seasons[0]?.episodes[0];
        if (!firstEpisode) throw new Error('Series has no episodes');
        playType = 'episode';
        playId = firstEpisode.id;
        if (!cancelled) {
          setSeasons(seriesData.seasons);
          setCurrentEpisode(firstEpisode);
        }
      } else if (contentType === 'episode') {
        const item = catalogItem as CatalogItem;
        if (!cancelled) {
          setCurrentEpisode({
            id: item.id,
            seriesId: 0,
            name: item.name,
            url: item.url,
            season: 1,
            episode: 1,
            cover: item.cover,
            addedAt: 0,
          });
        }
      }

      const [meta, proxied] = await Promise.all([
        luxAPI.player.getSource({ type: playType, id: playId }),
        luxAPI.player.getProxiedUrl({ type: playType, id: playId }),
      ]);
      if (proxied.error) throw new Error(proxied.error.message);
      if (meta.error) throw new Error(meta.error.message);
      if (cancelled) return;
      setPlaybackSource({
        url: proxied.data.url,
        mediaFormat: meta.data.mediaFormat,
        type: playType,
      });
    })().catch(() => {
      if (!cancelled) {
        setPlaybackSource(null);
        setProxyError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [catalogItem, contentType, contentId]);

  // Check resume position for VOD
  useEffect(() => {
    if (!playbackSource || playbackSource.type === 'live') return;

    getPosition(playbackSource.type, contentId).then((pos) => {
      if (pos && pos.position > 30 && pos.position < pos.duration - 30) {
        setResumePosition(pos.position);
        setShowResumeDialog(true);
      }
    });
  }, [playbackSource, contentId]);

  const handleResume = useCallback(() => {
    setShowResumeDialog(false);
    // VideoPlayer will seek to resumePosition on mount
  }, []);

  const handleRestart = useCallback(() => {
    setShowResumeDialog(false);
    setResumePosition(null);
  }, []);

  if (isLoading || (catalogItem && !playbackSource && !proxyError)) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        data-testid="player-loading"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || proxyError || !playbackSource) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        data-testid="player-error"
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load content</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const throttler = createPositionThrottler();

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden" data-testid="player-shell">
      <VideoPlayer
        source={playbackSource}
        onEnded={() => {
          throttler.flush().catch(console.error);
          // For episodes, next-episode card handles navigation
        }}
        onError={(err) => {
          throttler.flush().catch(console.error);
          console.error('[PlayerPage] Playback error:', err);
        }}
        onTimeUpdate={(pos) => {
          throttler.throttle(playbackSource.type, contentId, pos, playbackSource.mediaFormat === 'hls' ? 0 : 0);
        }}
        seasons={seasons}
        currentEpisode={currentEpisode}
        showNextEpisodeCard={playbackSource.type === 'episode'}
      />

      {showResumeDialog && resumePosition !== null && (
        <ResumeDialog
          position={resumePosition}
          duration={0} // Would be fetched from video duration
          onResume={handleResume}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};

export default PlayerPage;