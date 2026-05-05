import { z } from 'zod';
import { tevelFormSchema, type FormField } from './form-schema.js';

/**
 * Builds a Zod validator from a FormField definition. Used both by the API
 * (server-side validation) and the React client (form-level validation),
 * so a request rejected by one will also be rejected by the other.
 */
function fieldValidator(f: FormField): z.ZodTypeAny {
  let v: z.ZodTypeAny;
  switch (f.type) {
    case 'datetime':
      v = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'תאריך/שעה לא תקין');
      break;
    case 'date_range':
      v = z.object({ start: z.string(), end: z.string() });
      break;
    case 'dropdown':
      v = z.string().min(1);
      break;
    case 'multi_select':
    case 'checkbox_group':
      v = z.array(z.string()).default([]);
      break;
    case 'radio_yes_no':
      v = z.enum(['yes', 'no']);
      break;
    case 'long_text':
    case 'short_text':
      v = z.string().max(f.maxLength ?? 2000);
      break;
    case 'email':
      v = z.string().email('כתובת אימייל לא תקינה');
      break;
    case 'phone':
      v = z.object({
        countryCode: z.string().default('+972'),
        number: z.string().min(7).max(20),
      });
      break;
    case 'file':
      v = z.array(z.string()).default([]); // server-stored file ids
      break;
    case 'signature_name':
      v = z.string().min(1).max(f.maxLength ?? 30);
      break;
    default:
      v = z.unknown();
  }
  if (!f.required) v = v.optional().or(z.literal('')).or(z.null());
  return v;
}

export function buildPayloadSchema(schema: FormField[] = tevelFormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of schema) shape[f.id] = fieldValidator(f);
  return z.object(shape);
}

export const payloadSchema = buildPayloadSchema();
export type PtwPayload = z.infer<typeof payloadSchema>;
