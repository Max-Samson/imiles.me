import { imageSize } from 'image-size';
import { AppError, ValidationError } from '../errors';
import { sha256 } from '../security/hash';

export const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export interface ValidatedImage {
  bytes: Uint8Array<ArrayBuffer>;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
  hash: string;
}
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));
function invalid(): never {
  throw new ValidationError('图片格式损坏、不支持或包含动画');
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** 结构/尺寸检查，不在 Worker 中解码像素或抓取外部网址。 */
export async function validateImage(
  bytes: Uint8Array<ArrayBuffer>,
  declaredMime: string,
  limits: { maxBytes?: number; maxWidth?: number; maxHeight?: number; maxPixels?: number } = {},
): Promise<ValidatedImage> {
  const maxBytes = limits.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const maxWidth = limits.maxWidth ?? 4096;
  const maxHeight = limits.maxHeight ?? 4096;
  const maxPixels = limits.maxPixels ?? 12000000;
  if ([maxBytes, maxWidth, maxHeight, maxPixels].some((v) => !Number.isSafeInteger(v) || v < 1))
    throw new TypeError('Invalid image limits');
  if (!bytes.length || bytes.length > maxBytes)
    throw new AppError('图片为空或超过大小限制', 413, 'PAYLOAD_TOO_LARGE');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let mime: ValidatedImage['mime'];
  let extension: ValidatedImage['extension'];
  if (bytes.length >= 33 && ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') {
    mime = 'image/png';
    extension = 'png';
    let offset = 8;
    let header = false;
    let data = false;
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = ascii(bytes, offset + 4, 4);
      if (
        offset + 12 + length > bytes.length ||
        crc32(bytes.subarray(offset + 4, offset + 8 + length)) !==
          view.getUint32(offset + 8 + length)
      )
        invalid();
      if (!header && (type !== 'IHDR' || length !== 13)) invalid();
      if (type === 'IHDR') {
        if (header) invalid();
        header = true;
      }
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) invalid();
      if (type === 'IDAT' && length > 0) data = true;
      offset += 12 + length;
      if (type === 'IEND') {
        if (length !== 0 || offset !== bytes.length) invalid();
        ended = true;
        break;
      }
    }
    if (!header || !data || !ended) invalid();
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg';
    extension = 'jpg';
    let offset = 2;
    let scan = false;
    let ended = false;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) {
        ended = offset === bytes.length;
        break;
      }
      if (marker === undefined || marker === 0 || marker === 0xd8 || offset + 2 > bytes.length)
        invalid();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) invalid();
      offset += size;
      if (marker === 0xda) {
        scan = true;
        while (offset < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset++;
            continue;
          }
          const next = bytes[offset + 1];
          if (next === 0 || (next >= 0xd0 && next <= 0xd7)) {
            offset += 2;
            continue;
          }
          break;
        }
      }
    }
    if (!scan || !ended) invalid();
  } else if (bytes.length >= 20 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    mime = 'image/webp';
    extension = 'webp';
    if (view.getUint32(4, true) + 8 !== bytes.length) invalid();
    let offset = 12;
    let images = 0;
    while (offset + 8 <= bytes.length) {
      const type = ascii(bytes, offset, 4);
      const size = view.getUint32(offset + 4, true);
      if (
        !size ||
        offset + 8 + size + (size % 2) > bytes.length ||
        type === 'ANIM' ||
        type === 'ANMF'
      )
        invalid();
      if (type === 'VP8X' && (size !== 10 || bytes[offset + 8] & 2)) invalid();
      if (type === 'VP8 ' || type === 'VP8L') images++;
      offset += 8 + size + (size % 2);
    }
    if (offset !== bytes.length || images !== 1) invalid();
  } else {
    return invalid();
  }
  if (declaredMime !== mime) throw new ValidationError('图片实际类型与声明类型不一致');
  try {
    const { width, height } = imageSize(bytes);
    if (!width || !height || width > maxWidth || height > maxHeight || width * height > maxPixels)
      invalid();
  } catch {
    return invalid();
  }
  return { bytes, mime, extension, hash: await sha256(bytes) };
}
