import * as z from 'zod/v4';

const text = (max, required = false) => z.string().max(max).refine(value =>
  (!required || value.trim().length > 0) && !/[\u0000-\u0008\u000b-\u001f\ud800-\udfff]/u.test(value),
  'Use bounded text without control characters.');
const path = text(256).refine(value => !value.trim() || (value.trim().startsWith('/') && !value.trim().startsWith('//') && !/[?#]/u.test(value)),
  'Use a page path without query parameters or fragments.');
const reference = max => z.string().min(1).max(max).regex(/^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/u)
  .refine(value => !value.includes('://') && !value.includes('..'), 'Use an identifier, not a URL or query.');
const viewport = z.strictObject({ width: z.number().int().min(1).max(20000), height: z.number().int().min(1).max(20000) });
const legacyContext = z.strictObject({ path, release: text(100), feature: text(100), locator: text(300), viewport });
const target = z.strictObject({
  type: z.enum(['page', 'feature', 'data_record', 'data_result']),
  id: reference(200).nullable().optional(), collection: reference(120).nullable().optional(),
  label: z.string().max(120).refine(value => !/[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}]/u.test(value), 'Use a single-line label.').nullable().optional(),
});
const versionedContext = z.strictObject({
  version: z.literal(1), target,
  page: z.strictObject({ path }).nullable().optional(),
  release: text(100).nullable().optional(),
  dom: z.strictObject({ locator: text(300) }).nullable().optional(),
  viewport: viewport.nullable().optional(),
}).superRefine((context, ctx) => {
  const type = context.target.type;
  if ((type === 'page' && (!context.page?.path.trim() || context.target.collection != null)) ||
      (type === 'feature' && (!context.target.id || context.target.collection != null)) ||
      (['data_record', 'data_result'].includes(type) && (!context.target.id || !context.target.collection))) {
    ctx.addIssue({ code: 'custom', message: 'A page needs a path, a feature needs an ID, and a data target needs an ID and collection.' });
  }
});
export const empty = z.strictObject({});
export const cursor = z.string().min(1).max(1000);
export const listInput = z.strictObject({ limit: z.number().int().min(1).max(100).optional(), cursor: cursor.optional() });
export const exportInput = z.strictObject({ cursor: cursor.optional() });
export const getInput = z.strictObject({ id: z.uuid() });
export const reportInput = z.strictObject({
  id: z.uuid().describe('Stable receipt UUID. Generate it once and reuse it with identical content after any timeout or retry.'),
  kind: z.enum(['bug', 'idea']), message: text(3000, true), expected: text(2000),
  context: z.union([legacyContext, versionedContext]),
});
