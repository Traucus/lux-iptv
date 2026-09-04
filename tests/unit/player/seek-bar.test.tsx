// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { SeekBar } from '../../../src/renderer/components/molecules/osd/SeekBar';

function mockBarRect(width = 200) {
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      left: 0,
      width,
      right: width,
      top: 0,
      bottom: 8,
      height: 8,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
}

describe('SeekBar', () => {
  let mockOnSeek: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSeek = vi.fn();
    mockBarRect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with correct accessibility attributes', () => {
    render(<SeekBar currentTime={30} duration={120} buffered={[]} onSeek={mockOnSeek} />);
    const seekBar = screen.getByTestId('seek-bar');
    expect(seekBar).toHaveAttribute('role', 'slider');
    expect(seekBar).toHaveAttribute('aria-valuemin', '0');
    expect(seekBar).toHaveAttribute('aria-valuemax', '120');
    expect(seekBar).toHaveAttribute('aria-valuenow', '30');
    expect(seekBar).toHaveAttribute('tabIndex', '0');
  });

  it('shows buffered range at 60% of duration', () => {
    render(
      <SeekBar currentTime={30} duration={100} buffered={[{ start: 0, end: 60 }]} onSeek={mockOnSeek} />,
    );
    const bufferedRange = screen.getByTestId('buffered-range');
    expect(bufferedRange).toHaveStyle('left: 0%');
    expect(bufferedRange).toHaveStyle('width: 60%');
  });

  it('pointer drag from 50% to 75% seeks to 75% of duration', () => {
    render(<SeekBar currentTime={50} duration={100} buffered={[]} onSeek={mockOnSeek} />);
    const seekBar = screen.getByTestId('seek-bar');
    fireEvent.pointerDown(seekBar, { clientX: 100, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(seekBar, { clientX: 150, pointerId: 1, bubbles: true });
    fireEvent.pointerUp(seekBar, { clientX: 150, pointerId: 1, bubbles: true });
    expect(mockOnSeek).toHaveBeenLastCalledWith(75);
  });

  it('D-Pad right seeks forward 10s', () => {
    render(<SeekBar currentTime={50} duration={120} buffered={[]} onSeek={mockOnSeek} />);
    fireEvent.keyDown(screen.getByTestId('seek-bar'), { key: 'ArrowRight' });
    expect(mockOnSeek).toHaveBeenCalledWith(60);
  });

  it('D-Pad left seeks backward 10s', () => {
    render(<SeekBar currentTime={50} duration={120} buffered={[]} onSeek={mockOnSeek} />);
    fireEvent.keyDown(screen.getByTestId('seek-bar'), { key: 'ArrowLeft' });
    expect(mockOnSeek).toHaveBeenCalledWith(40);
  });

  it('D-Pad right clamps at duration', () => {
    render(<SeekBar currentTime={115} duration={120} buffered={[]} onSeek={mockOnSeek} />);
    fireEvent.keyDown(screen.getByTestId('seek-bar'), { key: 'ArrowRight' });
    expect(mockOnSeek).toHaveBeenCalledWith(120);
  });

  it('disabled state prevents interaction', () => {
    render(
      <SeekBar currentTime={50} duration={120} buffered={[]} onSeek={mockOnSeek} disabled={true} />,
    );
    fireEvent.keyDown(screen.getByTestId('seek-bar'), { key: 'ArrowRight' });
    expect(mockOnSeek).not.toHaveBeenCalled();
  });
});
