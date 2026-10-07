// Accepts only real PNG/JPEG/WebP/GIF images (checked by file signature, not by name or declared type), max 2 MB. No SVG, no executables.
export const MAX_IMAGE = 2 * 1024 * 1024;
export function sniffImage(buf) {
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length > 6 && ['GIF87a', 'GIF89a'].includes(buf.slice(0, 6).toString('latin1'))) return 'image/gif';
  return null;
}
export async function readImage(file) {
  if (!file || typeof file === 'string' || !file.size) throw Object.assign(new Error('Choose an image file.'), { userMessage: 'Choose an image file.' });
  if (file.size > MAX_IMAGE) throw Object.assign(new Error('big'), { userMessage: 'Image is too large (max 2 MB).' });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) throw Object.assign(new Error('type'), { userMessage: 'Only PNG, JPEG, WebP or GIF images are allowed.' });
  return { buf, mime };
}
