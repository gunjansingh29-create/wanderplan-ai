import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import YesNoCard from '../components/YesNoCard';

describe('YesNoCard', () => {
  it('should render with correct text when given props', () => {
    const { getByText } = render(<YesNoCard question="Are you sure?" />);
    expect(getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should call onYes when Yes button clicked', () => {
    const onYes = jest.fn();
    const { getByText } = render(<YesNoCard onYes={onYes} />);
    fireEvent.click(getByText('Yes'));
    expect(onYes).toHaveBeenCalled();
  });

  it('should call onNo when No button clicked', () => {
    const onNo = jest.fn();
    const { getByText } = render(<YesNoCard onNo={onNo} />);
    fireEvent.click(getByText('No'));
    expect(onNo).toHaveBeenCalled();
  });

  it('should disable buttons when loading', () => {
    const { getByText } = render(<YesNoCard loading={true} />);
    expect(getByText('Yes')).toBeDisabled();
    expect(getByText('No')).toBeDisabled();
  });

  it('should render custom labels', () => {
    const { getByText } = render(<YesNoCard yesLabel="Yup" noLabel="Nope" />);
    expect(getByText('Yup')).toBeInTheDocument();
    expect(getByText('Nope')).toBeInTheDocument();
  });
});
