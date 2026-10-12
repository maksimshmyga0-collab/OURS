/**
 * Client-side photo optimization utility for OURS
 * Scales down large camera photos (e.g. 12-48MP from Android devices) to max 960px dimension
 * and compresses to crisp, high-quality JPEG (~120-220KB) before uploading or persisting.
 * Includes explicit memory cleanup and OOM safeguards for Android WebView / mobile browsers.
 */

function dataURItoBlob(dataURI: string): Blob {
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch {
    return new Blob([], { type: 'image/jpeg' });
  }
}

export async function optimizePhotoForUpload(
  fileOrDataUrl: File | Blob | string,
  maxDimension: number = 960,
  quality: number = 0.80,
  flipHorizontal: boolean = false
): Promise<string> {
  // Pass through remote HTTP/HTTPS URLs untouched (unless flip is requested)
  if (
    !flipHorizontal &&
    typeof fileOrDataUrl === 'string' &&
    (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))
  ) {
    return fileOrDataUrl;
  }

  // If already an optimized small data URI (< 350KB) and no flip requested, return directly
  if (
    !flipHorizontal &&
    typeof fileOrDataUrl === 'string' &&
    fileOrDataUrl.startsWith('data:image/') &&
    fileOrDataUrl.length < 350000
  ) {
    return fileOrDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    let objectUrl: string | null = null;

    const cleanup = () => {
      try {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      } catch {}

      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        objectUrl = null;
      }
    };

    const processImage = () => {
      let canvas: HTMLCanvasElement | null = null;
      try {
        let { width, height } = img;

        if (width <= 0 || height <= 0) {
          cleanup();
          resolve(typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 1000000 ? fileOrDataUrl : '');
          return;
        }

        // Scale down to maxDimension preserving aspect ratio
        let targetWidth = width;
        let targetHeight = height;

        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, targetWidth);
        canvas.height = Math.max(1, targetHeight);

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) {
          cleanup();
          resolve(typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 1000000 ? fileOrDataUrl : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        if (flipHorizontal) {
          ctx.save();
          ctx.translate(targetWidth, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          ctx.restore();
        } else {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }

        let optimized = '';
        try {
          optimized = canvas.toDataURL('image/jpeg', quality);
        } catch {
          // If toDataURL failed on OOM, attempt downscaling further to 720px
          if (targetWidth > 720 || targetHeight > 720) {
            canvas.width = 720;
            canvas.height = Math.round((targetHeight * 720) / targetWidth);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            optimized = canvas.toDataURL('image/jpeg', 0.75);
          }
        }

        // Immediately release GPU texture memory
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        cleanup();

        if (optimized && optimized.startsWith('data:image/')) {
          resolve(optimized);
        } else {
          resolve(typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 1000000 ? fileOrDataUrl : '');
        }
      } catch (err) {
        console.warn('[OURS ImageOptimizer] Optimization exception:', err);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        cleanup();
        resolve(typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 1000000 ? fileOrDataUrl : '');
      }
    };

    img.onload = processImage;
    img.onerror = () => {
      cleanup();
      resolve(typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 1000000 ? fileOrDataUrl : '');
    };

    try {
      if (typeof fileOrDataUrl === 'string') {
        if (fileOrDataUrl.startsWith('data:image/') && fileOrDataUrl.length > 1500000) {
          // Convert huge data URL to Blob & ObjectURL to avoid duplicating string memory
          const blob = dataURItoBlob(fileOrDataUrl);
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } else {
          img.src = fileOrDataUrl;
        }
      } else {
        objectUrl = URL.createObjectURL(fileOrDataUrl);
        img.src = objectUrl;
      }
    } catch {
      cleanup();
      resolve('');
    }
  });
}
