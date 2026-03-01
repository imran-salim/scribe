import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecorderPanel from './RecorderPanel';
import type { User } from '../types';

const mockUser: User = { id: 1, email: 'user@example.com' };

const defaultProps = {
  user: mockUser,
  onLogout: vi.fn(),
  recording: false,
  onStart: vi.fn(),
  onStop: vi.fn(),
  audioUrl: null,
  mimeType: '',
  error: null,
  transcript: '',
};

beforeEach(() => vi.clearAllMocks());

describe('RecorderPanel', () => {
  it('renders the user email', () => {
    render(<RecorderPanel {...defaultProps} />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('start button is enabled when not recording', () => {
    render(<RecorderPanel {...defaultProps} recording={false} />);
    expect(screen.getByRole('button', { name: /start recording/i })).toBeEnabled();
  });

  it('start button is disabled when recording', () => {
    render(<RecorderPanel {...defaultProps} recording={true} />);
    expect(screen.getByRole('button', { name: /start recording/i })).toBeDisabled();
  });

  it('stop button is disabled when not recording', () => {
    render(<RecorderPanel {...defaultProps} recording={false} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
  });

  it('stop button is enabled when recording', () => {
    render(<RecorderPanel {...defaultProps} recording={true} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeEnabled();
  });

  it('shows recording indicator only while recording', () => {
    const { rerender } = render(<RecorderPanel {...defaultProps} recording={false} />);
    expect(screen.queryByText(/recording\.\.\./i)).not.toBeInTheDocument();

    rerender(<RecorderPanel {...defaultProps} recording={true} />);
    expect(screen.getByText(/recording\.\.\./i)).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    render(<RecorderPanel {...defaultProps} error="Microphone denied" />);
    expect(screen.getByText('Microphone denied')).toBeInTheDocument();
  });

  it('does not show error block when error is null', () => {
    render(<RecorderPanel {...defaultProps} error={null} />);
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('shows transcript text when available', () => {
    render(<RecorderPanel {...defaultProps} transcript="This is my transcript." />);
    expect(screen.getByText('This is my transcript.')).toBeInTheDocument();
  });

  it('shows placeholder when transcript is empty', () => {
    render(<RecorderPanel {...defaultProps} transcript="" />);
    expect(screen.getByText(/no transcript available yet/i)).toBeInTheDocument();
  });

  it('calls onStart when start button is clicked', async () => {
    const user = userEvent.setup();
    render(<RecorderPanel {...defaultProps} recording={false} />);

    await user.click(screen.getByRole('button', { name: /start recording/i }));

    expect(defaultProps.onStart).toHaveBeenCalledOnce();
  });

  it('calls onStop when stop button is clicked', async () => {
    const user = userEvent.setup();
    render(<RecorderPanel {...defaultProps} recording={true} />);

    await user.click(screen.getByRole('button', { name: /stop/i }));

    expect(defaultProps.onStop).toHaveBeenCalledOnce();
  });

  it('calls onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    render(<RecorderPanel {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(defaultProps.onLogout).toHaveBeenCalledOnce();
  });

  it('shows audio player when audioUrl is set', () => {
    const { container } = render(<RecorderPanel {...defaultProps} audioUrl="blob:mock" mimeType="audio/webm" />);
    expect(container.querySelector('audio')).toBeInTheDocument();
  });

  it('shows mime type label when audioUrl and mimeType are set', () => {
    render(<RecorderPanel {...defaultProps} audioUrl="blob:mock" mimeType="audio/webm;codecs=opus" />);
    expect(screen.getByText(/audio\/webm;codecs=opus/i)).toBeInTheDocument();
  });
});
