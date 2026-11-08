// Draws a photo onto a canvas the right way up. Phone photos (selfies especially) store
// pixels sideways or mirrored plus an EXIF orientation tag. An <img> element applies that
// tag (CSS `image-orientation: from-image`, the default in current Safari and Chrome), while
// createImageBitmap ignores it in some Safari versions, which turned selfies sideways.
// So decode with <img> first and only fall back to createImageBitmap with an explicit option.
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.style.imageOrientation = 'from-image';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('decode'));
      element.src = url;
    });
    if (image.naturalWidth && image.naturalHeight) {
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
    }
  } catch { /* fall through */ }
  URL.revokeObjectURL(url);
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  throw new Error('이 사진 형식은 브라우저에서 읽을 수 없습니다.');
}

export async function photoToCanvas(file: Blob, maxSide = 1800): Promise<HTMLCanvasElement> {
  const decoded = await decode(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('사진을 변환하지 못했습니다.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    decoded.release();
  }
}

// Returns a left-right flipped JPEG of the photo, upright. Used for selfies taken through the
// web camera input: unlike the phone's own camera app, it saves them un-mirrored.
export async function mirrorPhotoFile(file: File): Promise<File> {
  const upright = await photoToCanvas(file, 2400);
  const canvas = document.createElement('canvas');
  canvas.width = upright.width; canvas.height = upright.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('사진을 뒤집지 못했습니다.');
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(upright, 0, 0);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

// Reads the EXIF LensModel of a JPEG ("iPhone 15 front camera 2.69mm f/1.9") to tell a selfie.
// Returns false when the tag is missing (e.g. many Android phones); the user can still flip by hand.
export async function isFrontCameraPhoto(file: Blob): Promise<boolean> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return false;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset), size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return lensIsFront(view, offset + 10);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return false;
      offset += 2 + size;
    }
  } catch { /* unreadable: treat as unknown */ }
  return false;
}

function lensIsFront(view: DataView, tiff: number): boolean {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (at: number) => view.getUint16(tiff + at, little), u32 = (at: number) => view.getUint32(tiff + at, little);
  const findTag = (ifd: number, tag: number) => {
    const count = u16(ifd);
    for (let index = 0; index < count; index++) {
      const entry = ifd + 2 + index * 12;
      if (u16(entry) === tag) return entry;
    }
    return -1;
  };
  const exifPointer = findTag(u32(4), 0x8769);
  if (exifPointer < 0) return false;
  const lens = findTag(u32(exifPointer + 8), 0xa434);
  if (lens < 0) return false;
  const length = u32(lens + 4), start = length > 4 ? u32(lens + 8) : lens + 8;
  let text = '';
  for (let index = 0; index < Math.min(length, 128); index++) {
    const code = view.getUint8(tiff + start + index);
    if (!code) break;
    text += String.fromCharCode(code);
  }
  return /front/i.test(text);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/webp', quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('사진을 변환하지 못했습니다.')), type, quality));
}
