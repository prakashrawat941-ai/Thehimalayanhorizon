import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalPanel, Button, FormField, TextInput } from '../../components/ui/index.jsx';

describe('accessible UI primitives', () => {
  it('associates a required field with its hint and error', () => {
    render(<FormField label="Employee ID" hint="Use the assigned ID" error="ID is required" required>
      <TextInput />
    </FormField>);
    const input = screen.getByRole('textbox', { name: /Employee ID/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Use the assigned ID ID is required');
  });

  it('disables the decision actions until a reason is entered and trims it', () => {
    const decide = vi.fn();
    render(<ApprovalPanel title="Review change" current="Draft" proposed="Published" version={3} onDecision={decide} />);
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Decision note' }), { target: { value: '  verified   ' } });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    expect(decide).toHaveBeenCalledWith('approved', 'verified');
  });

  it('busy buttons cannot submit twice', () => {
    render(createElement(Button, { busy: true }, 'Save'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
  });
});
