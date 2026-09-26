/**
 * Client-side photo optimization utility
 * Scales down large camera photos (e.g. 12-48MP from Android) to max 1280px dimension
 * and compresses to crisp, high-quality JPEG (~150-250KB) before uploading to Supabase.
 */

export async function optimizePhotoForUpload(
  fileOrDataUrl: File | Blob | string,
  maxDimension: number = 960,
  quality: number = 0.82
): Promise<string> {
  // Pass through remote URLs untouched
  if (
    typeof fileOrDataUrl === 'string' &&
    (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))
  ) {
    return fileOrDataUrl;
  }

  // If already an optimized data URI (< 300KB), return directly to avoid redundant recompression
  if (
    typeof fileOrDataUrl === 'string' &&
    fileOrDataUrl.startsWith('data:image/') &&
    fileOrDataUrl.length < 400000
  ) {
    return fileOrDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();

    const processImage = () => {
      try {
        let { width, height } = img;

        if (width <= 0 || height <= 0) {
          resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
          return;
        }

        // Scale down to maxDimension preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) {
          resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
          return;
        }

        ctx.imageSmoothingQuality = 'medium';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const optimized = canvas.toDataURL('image/jpeg', quality);
        resolve(optimized);
      } catch (err) {
        console.warn('[OURS ImageOptimizer] Optimization fallback:', err);
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
      }
    };

    img.onload = processImage;
    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const objectUrl = URL.createObjectURL(fileOrDataUrl);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        processImage();
      };
      img.src = objectUrl;
    }
  });
}
