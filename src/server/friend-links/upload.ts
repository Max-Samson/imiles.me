import { AppError, ValidationError } from '../errors';
import { type ValidatedImage, validateImage } from '../media/images';
import { readBoundedBytes } from '../rest/body';
import { submissionSchema } from './validation';

export async function readSubmission(request: Request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType))
    throw new AppError('请使用 multipart/form-data', 415, 'UNSUPPORTED_MEDIA_TYPE');
  const bytes = await readBoundedBytes(request.body, 3 * 1024 * 1024);
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new ValidationError('表单格式无效');
  }
  const fields: Record<string, string> = {};
  const seen = new Set<string>();
  let screenshot: ValidatedImage | undefined;
  let textBytes = 0;
  for (const [key, value] of form) {
    if (seen.has(key)) throw new ValidationError('表单字段不能重复');
    seen.add(key);
    if (key === 'screenshot') {
      if (typeof value === 'string') throw new ValidationError('截图必须是文件');
      screenshot = await validateImage(new Uint8Array(await value.arrayBuffer()), value.type);
    } else {
      if (
        !['url', 'description', 'email', 'turnstileToken', 'name'].includes(key) ||
        typeof value !== 'string'
      )
        throw new ValidationError('表单包含未知字段');
      textBytes += new TextEncoder().encode(value).length;
      if (textBytes > 8192) throw new AppError('文本字段过大', 413, 'PAYLOAD_TOO_LARGE');
      fields[key] = value;
    }
  }
  return { ...submissionSchema.parse(fields), screenshot };
}
export type Submission = Awaited<ReturnType<typeof readSubmission>>;
