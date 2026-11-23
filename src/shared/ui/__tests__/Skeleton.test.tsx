import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Skeleton,
  SkeletonCardList,
  SkeletonPageFallback,
  SkeletonPhTrackerView,
  SkeletonProfileView,
  SkeletonRosterWorkspace,
  SkeletonTableCard,
} from '../Skeleton';

describe('Shimmer Skeleton Loaders', () => {
  it('renders base Skeleton as aria-hidden with warm shimmer class', () => {
    const { container } = render(<Skeleton className="h-4 w-24" rounded="full" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('skeleton-shimmer');
    expect(el.className).toContain('rounded-full');
  });

  it('renders accessible role="status" presets with shimmer placeholders', () => {
    const presets = [
      { ui: <SkeletonPageFallback />, text: /Loading workspace view/i },
      { ui: <SkeletonTableCard rows={3} cols={3} />, text: /Loading table/i },
      { ui: <SkeletonCardList count={2} srLabel="Loading cards..." />, text: /Loading cards/i },
      { ui: <SkeletonProfileView />, text: /Fetching profile from database/i },
      { ui: <SkeletonPhTrackerView />, text: /Loading Public Holiday & GHKA Tracker/i },
      { ui: <SkeletonRosterWorkspace />, text: /Loading roster workspace/i },
    ];

    for (const preset of presets) {
      const { container, unmount } = render(preset.ui);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(preset.text);
      expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
      unmount();
    }
  });
});
