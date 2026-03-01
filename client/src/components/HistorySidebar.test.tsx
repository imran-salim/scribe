import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistorySidebar from './HistorySidebar';
import type { HistoryItem } from '../types';

const makeItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
  id: 1,
  text: 'Hello world',
  filename: 'recording.webm',
  createdAt: '2024-06-01T12:00:00.000Z',
  ...overrides,
});

describe('HistorySidebar', () => {
  it('shows empty state message when history is empty', () => {
    render(<HistorySidebar history={[]} />);
    expect(screen.getByText(/no past transcriptions/i)).toBeInTheDocument();
  });

  it('does not show empty message when history has items', () => {
    render(<HistorySidebar history={[makeItem()]} />);
    expect(screen.queryByText(/no past transcriptions/i)).not.toBeInTheDocument();
  });

  it('renders the text of each history item', () => {
    const items = [
      makeItem({ id: 1, text: 'First recording' }),
      makeItem({ id: 2, text: 'Second recording' }),
    ];
    render(<HistorySidebar history={items} />);

    expect(screen.getByText('First recording')).toBeInTheDocument();
    expect(screen.getByText('Second recording')).toBeInTheDocument();
  });

  it('renders a formatted date for each item', () => {
    render(<HistorySidebar history={[makeItem({ createdAt: '2024-06-01T12:00:00.000Z' })]} />);
    // toLocaleString output varies by locale, so just check something date-like is present
    const dateText = new Date('2024-06-01T12:00:00.000Z').toLocaleString();
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  it('renders multiple items without duplicating the empty message', () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2 }), makeItem({ id: 3 })];
    render(<HistorySidebar history={items} />);
    expect(screen.queryByText(/no past transcriptions/i)).not.toBeInTheDocument();
  });
});
