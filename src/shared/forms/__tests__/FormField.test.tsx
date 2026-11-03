import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FormField, useZodForm } from '@/shared/forms';
import { Button } from '@/shared/ui';

const demoSchema = z.object({
  reasonSummary: z.string().min(4, 'Enter at least 4 characters for the request reason.'),
});

function DemoForm({ onValid }: { onValid: (value: string) => void }) {
  const form = useZodForm(demoSchema, {
    defaultValues: { reasonSummary: '' },
  });

  const errorMessage = form.formState.errors.reasonSummary?.message;

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        onValid(values.reasonSummary);
      })}
      noValidate
    >
      <FormField
        id="reason-summary"
        label="Operational Reason"
        required
        hint="Provide brief administrative context without medical diagnoses."
        error={errorMessage}
      >
        <input
          id="reason-summary"
          type="text"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? 'reason-summary-error' : 'reason-summary-hint'}
          className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-solid px-3 py-2 text-sm text-text-primary"
          {...form.register('reasonSummary')}
        />
      </FormField>
      <Button type="submit" variant="primary" className="mt-3">
        Validate Entry
      </Button>
    </form>
  );
}

describe('useZodForm & FormField (React Hook Form + Zod v4)', () => {
  it('validates on blur/submit without disruptive per-keystroke errors', async () => {
    const user = userEvent.setup();
    let submittedValue = '';

    render(
      <DemoForm
        onValid={(val) => {
          submittedValue = val;
        }}
      />,
    );

    const input = screen.getByLabelText(/Operational Reason/i);
    await user.type(input, 'ab');
    // While still focused and typing, blur validation has not fired yet.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Blurring triggers validation error cleanly.
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 4 characters/i);

    await user.clear(input);
    await user.type(input, 'Annual conference leave');
    await user.click(screen.getByRole('button', { name: /Validate Entry/i }));

    expect(submittedValue).toBe('Annual conference leave');
  });
});
