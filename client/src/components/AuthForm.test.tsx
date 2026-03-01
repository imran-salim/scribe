import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthForm from './AuthForm';

const defaultProps = {
  isRegistering: false,
  isVerifying: false,
  authError: null,
  onSubmit: vi.fn(),
  onToggleMode: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('AuthForm', () => {
  it('shows "Sign in" heading by default', () => {
    render(<AuthForm {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows "Create an account" heading when registering', () => {
    render(<AuthForm {...defaultProps} isRegistering={true} />);
    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
  });

  it('submit button reads "Sign In" by default', () => {
    render(<AuthForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submit button reads "Register" when registering', () => {
    render(<AuthForm {...defaultProps} isRegistering={true} />);
    expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument();
  });

  it('submit button reads "Processing..." when verifying', () => {
    render(<AuthForm {...defaultProps} isVerifying={true} />);
    expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
  });

  it('calls onSubmit when the form is submitted', async () => {
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/email address/i), 'a@b.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(defaultProps.onSubmit).toHaveBeenCalledOnce();
  });

  it('disables inputs and submit button while verifying', () => {
    render(<AuthForm {...defaultProps} isVerifying={true} />);

    expect(screen.getByPlaceholderText(/email address/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
  });

  it('shows authError message', () => {
    render(<AuthForm {...defaultProps} authError="Invalid credentials" />);
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('does not show error element when authError is null', () => {
    render(<AuthForm {...defaultProps} authError={null} />);
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it('calls onToggleMode when toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /need an account/i }));

    expect(defaultProps.onToggleMode).toHaveBeenCalledOnce();
  });

  it('toggle button text reflects isRegistering state', () => {
    const { rerender } = render(<AuthForm {...defaultProps} isRegistering={false} />);
    expect(screen.getByRole('button', { name: /need an account/i })).toBeInTheDocument();

    rerender(<AuthForm {...defaultProps} isRegistering={true} />);
    expect(screen.getByRole('button', { name: /already have an account/i })).toBeInTheDocument();
  });
});
