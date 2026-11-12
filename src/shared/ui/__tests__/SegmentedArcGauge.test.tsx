import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SegmentedArcGauge } from '../SegmentedArcGauge';

describe('SegmentedArcGauge', () => {
  it('renders overall progress label, custom title, and subtitle', () => {
    render(
      <SegmentedArcGauge
        label="Overall progress"
        value={77}
        title="77%"
        subtitle="Near complete"
      />,
    );

    expect(screen.getByText('Overall progress')).toBeInTheDocument();
    expect(screen.getByText('77%')).toBeInTheDocument();
    expect(screen.getByText('Near complete')).toBeInTheDocument();
  });

  it('renders exactly 16 discrete SVG arc line segments', () => {
    const { container } = render(
      <SegmentedArcGauge
        value={50}
        maxValue={100}
      />,
    );

    const lines = container.querySelectorAll('svg line');
    expect(lines).toHaveLength(16);
  });

  it('calculates default percentage title when none is supplied', () => {
    render(
      <SegmentedArcGauge
        value={15}
        maxValue={20}
      />,
    );

    // 15/20 = 75%
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
