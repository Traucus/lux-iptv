import React from 'react';
import { VideoPlayerOsdChrome } from './video-player/osd-chrome';
import { VideoPlayerOverlays } from './video-player/overlays';
import type { VideoPlayerProps } from './video-player/types';
import { useVideoPlayer } from './video-player/use-video-player';

/**
 * VideoPlayer — Fullscreen video player organism with OSD overlay.
 *
 * Hosts the in-process libmpv surface. Chromium hls.js / mpegts / native
 * `<video>` engines are not the product playback path.
 */

export type { PlaybackSource, VideoPlayerProps } from './video-player/types';

export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const { source, diagnosis = null, onNextEpisode, className = '' } = props;
  const player = useVideoPlayer(props);

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: player.aspectRatio === 'zoom' ? 'cover' : 'contain',
    background: '#000',
  };

  if (player.aspectRatio === '4:3') {
    videoStyle.aspectRatio = '4/3';
  }

  return (
    <div
      className={`video-player ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
      }}
      data-testid="video-player"
      onMouseMove={() => {}} // Keep OSD visible on mouse move (handled by useIdleOSD)
    >
      <div
        style={videoStyle}
        data-testid="libmpv-surface"
        aria-label="libmpv surface"
      />
      <input
        ref={player.subtitleFileInputRef}
        type="file"
        accept=".srt,.ass"
        data-testid="osd-add-subtitle"
        title="Add subtitle"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const path =
            'path' in file && typeof file.path === 'string' ? file.path : file.name;
          player.handleAddSubtitle(path);
        }}
      />

      <VideoPlayerOverlays
        engineState={player.engineState}
        diagnosis={diagnosis}
        errorMessage={player.errorMessage}
        osdVisible={player.osdVisible}
        sourceType={source.type}
        showNextEpisodeCardState={player.showNextEpisodeCardState}
        nextEpisode={player.nextEpisode}
        onWatchNow={() => {
          player.setShowNextEpisodeCardState(false);
          if (player.nextEpisode) onNextEpisode?.(player.nextEpisode);
        }}
        onDismiss={() => player.setShowNextEpisodeCardState(false)}
      />

      {player.osdVisible && (
        <VideoPlayerOsdChrome
          sourceType={source.type}
          currentTime={player.currentTime}
          duration={player.duration}
          buffered={player.buffered}
          isPlaying={player.isPlaying}
          audioTrackIndex={player.audioTrackIndex}
          audioTracks={player.audioTracks}
          subtitleTrackIndex={player.subtitleTrackIndex}
          subtitleTracks={player.subtitleTracks}
          aspectRatio={player.aspectRatio}
          onSeek={player.handleSeek}
          onRewind10={player.handleRewind10}
          onPlayPause={player.handlePlayPause}
          onForward10={player.handleForward10}
          onAudioTrackChange={player.handleAudioTrackChange}
          onSubtitleTrackChange={player.handleSubtitleTrackChange}
          onAspectRatioChange={player.setAspectRatio}
          onFullscreen={player.handleFullscreen}
          onLoadSubtitle={player.handleLoadSubtitle}
        />
      )}
    </div>
  );
};

export default VideoPlayer;
