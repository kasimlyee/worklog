import 'server-only';
import * as z from 'zod';
import { parseIsoDate, type IsoDate } from '#src/server/domain/calendar.ts';

/*
 * Field schemas shared by every service. Inputs arrive from forms as strings, so empty
 * strings mean "not set" for optional fields. Lengths match the database CHECKs.
 */

export function requiredText(label: string, max: number): z.ZodType<string> {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${String(max)} characters.`);
}

export function optionalText(label: string, max: number): z.ZodType<string> {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${String(max)} characters.`)
    .nullish()
    .transform((value) => value ?? '');
}

export function requiredDate(label: string): z.ZodType<IsoDate> {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .transform((value, ctx) => {
      const date = parseIsoDate(value);
      if (date === null) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a valid date.` });
        return z.NEVER;
      }
      return date;
    });
}

export function optionalDate(label: string): z.ZodType<IsoDate | null> {
  return z
    .union([z.literal(''), z.null(), requiredDate(label)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value));
}

const uuid = z.uuid({ error: 'Choose a valid option.' });

export const id: z.ZodType<string> = uuid;

export const optionalId: z.ZodType<string | null> = z
  .union([z.literal(''), z.null(), uuid])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

export function idList(label: string, { min = 0, max = 50 } = {}): z.ZodType<readonly string[]> {
  return z
    .union([uuid, z.array(uuid), z.null()])
    .optional()
    .transform((value) => [...new Set(value === undefined || value === null ? [] : [value].flat())])
    .refine((ids) => ids.length >= min, min === 1 ? `Choose at least one ${label}.` : `Choose at least ${String(min)}.`)
    .refine((ids) => ids.length <= max, `Choose at most ${String(max)}.`);
}

/** BR-34: http(s) only. */
export function webUrl(label: string): z.ZodType<string> {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .max(2000, `${label} is too long.`)
    .refine((value) => {
      if (!/^https?:\/\//i.test(value)) {
        return false;
      }
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, `${label} must start with https:// or http://`);
}

export function optionalWebUrl(label: string): z.ZodType<string | null> {
  return z
    .union([z.literal(''), z.null(), webUrl(label)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value));
}

export function oneOf<const T extends readonly [string, ...string[]]>(
  values: T,
  label: string,
): z.ZodType<T[number]> {
  return z.enum(values, { error: `Choose a valid ${label}.` });
}

export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}
