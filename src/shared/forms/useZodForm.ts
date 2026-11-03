import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type * as z4 from 'zod/v4/core';

/**
 * Shared form hook enforcing blur/submit validation per 08_FRONTEND_UX.md.
 */
export function useZodForm<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TSchema extends z4.$ZodType<TOutput, TInput>,
>(
  schema: TSchema,
  options?: Omit<UseFormProps<z4.input<TSchema>, unknown, z4.output<TSchema>>, 'resolver'> & {
    defaultValues?: DefaultValues<z4.input<TSchema>>;
  },
): UseFormReturn<z4.input<TSchema>, unknown, z4.output<TSchema>> {
  return useForm<z4.input<TSchema>, unknown, z4.output<TSchema>>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: true,
    ...options,
    resolver: zodResolver(schema),
  });
}
