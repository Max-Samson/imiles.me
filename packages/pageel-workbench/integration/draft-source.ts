import { replaceSourceBody, updateSourceFields } from '../../../src/lib/content-source';

/** 只应用本轮修改；仅改属性时，原有 MDX 正文及空白字符保持不变。 */
export function composeDraftSource(
  baseline: string,
  previousFields: Record<string, unknown>,
  nextFields: Record<string, unknown>,
  nextBody: string,
  bodyChanged: boolean,
): string {
  const updates = Object.fromEntries(
    Object.entries(nextFields).filter(([key, value]) =>
      JSON.stringify(previousFields[key]) !== JSON.stringify(value),
    ),
  );
  const withFields = updateSourceFields(baseline, updates);
  return bodyChanged ? replaceSourceBody(withFields, nextBody) : withFields;
}
