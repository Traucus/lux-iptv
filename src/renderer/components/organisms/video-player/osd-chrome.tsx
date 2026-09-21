import React from 'react';
import { SeekBar } from '../../molecules/osd/SeekBar';
import { OsdTopBar } from '../../molecules/osd/OsdTopBar';
import { OsdControls } from '../../molecules/osd/OsdControls';
import { isLiveRewindEnabled, OSD_HWND_INSET, type PlayerTrack } from '../../../features/player/player-chrome';
import type { AspectRatio, PlaybackSource } from './types';

export function VideoPlayerOsdChrome({
  sourceType,
  currentTime,
  duration,
  buffered,
  isPlaying,
  audioTrackIndex,
  audioTracks,
  subtitleTrackIndex,
  subtitleTracks,
  aspectRatio,
  onSeek,
  onRewind10,
  onPlayPause,
  onForward10,
  onAudioTrackChange,
  onSubtitleTrackChange,
  onAspectRatioChange,
  onFullscreen,
  onLoadSubtitle,
}: {
  sourceType: PlaybackSource['type'];
  currentTime: number;
  duration: number;
  buffered: Array<{ start: number; end: number }>;
  isPlaying: boolean;
  audioTrackIndex: number;
  audioTracks: PlayerTrack[];
  subtitleTrackIndex: number;
  subtitleTracks: PlayerTrack[];
  aspectRatio: AspectRatio;
  onSeek: (time: number) => void;
  onRewind10: () => void;
  onPlayPause: () => void;
  onForward10: () => void;
  onAudioTrackChange: (index: number) => void;
  onSubtitleTrackChange: (index: number) => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onFullscreen: () => void;
  onLoadSubtitle: () => void;
}): React.ReactElement {
  return (
    <>
      <div
        data-testid="osd-chrome-top"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: OSD_HWND_INSET.top,
          zIndex: 20,
        }}
      >
        <OsdTopBar
          title={sourceType === 'live' ? 'Live TV' : 'Content Title'}
          resolution={undefined}
          audioTrack={audioTracks[audioTrackIndex]?.name}
          onBack={() => {
            window.history.back();
          }}
          visible={true}
        />
      </div>

      <div
        data-testid="osd-chrome-bottom"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: OSD_HWND_INSET.bottom,
          zIndex: 20,
        }}
      >
        {sourceType !== 'live' && (
          <div style={{ padding: '12px 24px 0' }}>
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              buffered={buffered}
              onSeek={onSeek}
              disabled={duration <= 0}
            />
          </div>
        )}
        <OsdControls
          isPlaying={isPlaying}
          audioTrackIndex={audioTrackIndex}
          audioTracks={audioTracks}
          subtitleTrackIndex={subtitleTrackIndex}
          subtitleTracks={subtitleTracks}
          aspectRatio={aspectRatio}
          visible={true}
          onRewind10={onRewind10}
          onPlayPause={onPlayPause}
          onForward10={onForward10}
          onAudioTrackChange={onAudioTrackChange}
          onSubtitleTrackChange={onSubtitleTrackChange}
          onAspectRatioChange={onAspectRatioChange}
          onFullscreen={onFullscreen}
          onLoadSubtitle={onLoadSubtitle}
          rewindDisabled={!isLiveRewindEnabled(sourceType)}
        />
      </div>
    </>
  );
}
