import React from 'react';
import { render } from '@testing-library/react';
import TripProgressStepper from '../components/TripProgressStepper';

describe('TripProgressStepper', () => {
  it('should render all stages', () => {
    const stages = ['Start', 'Plan', 'Book', 'Travel', 'Finish'];
    const { getByText } = render(<TripProgressStepper stages={stages} current={0} />);
    stages.forEach(stage => {
      expect(getByText(stage)).toBeInTheDocument();
    });
  });

  it('should highlight current stage', () => {
    const stages = ['Start', 'Plan', 'Book'];
    const { getByTestId } = render(<TripProgressStepper stages={stages} current={1} />);
    expect(getByTestId('step-1')).toHaveClass('active');
  });

  it('should not highlight other stages', () => {
    const stages = ['Start', 'Plan', 'Book'];
    const { getByTestId } = render(<TripProgressStepper stages={stages} current={2} />);
    expect(getByTestId('step-0')).not.toHaveClass('active');
    expect(getByTestId('step-1')).not.toHaveClass('active');
    expect(getByTestId('step-2')).toHaveClass('active');
  });

  it('should handle out-of-bounds current index', () => {
    const stages = ['Start', 'Plan', 'Book'];
    const { getByTestId } = render(<TripProgressStepper stages={stages} current={5} />);
    stages.forEach((_, i) => {
      expect(getByTestId(`step-${i}`)).not.toHaveClass('active');
    });
  });

  it('should render with empty stages', () => {
    const { container } = render(<TripProgressStepper stages={[]} current={0} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
