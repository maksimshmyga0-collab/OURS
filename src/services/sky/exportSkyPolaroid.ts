import { SkyState } from './skyService';
import { OURS_LOGO_URL } from '../../components/OursLogo';

/**
 * Exports the couple's exact currently viewed Sky as a 1080x1350 px minimalist Polaroid card.
 * - 4:5 aspect ratio PNG (1080 × 1350 px)
 * - Warm milk Polaroid paper frame
 * - Exact 1:1 sky viewport matching the on-screen stars and subtle lines
 * - Wide bottom white margin with «Наше небо» and the authentic OURS overlapping duo spheres
 * - Filename: ours-our-sky-YYYY-MM.png
 */
export async function exportSkyPolaroid(sky: SkyState): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  try {
    const width = 1080;
    const height = 1350;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // 1. Draw Polaroid Warm Paper Background
    ctx.fillStyle = '#FAF7F5';
    ctx.fillRect(0, 0, width, height);

    // Subtle natural frame border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // 2. Sky Viewport Dimensions
    const padX = 72;
    const padTop = 72;
    const skySize = width - padX * 2; // 936 px
    const skyRadius = 24;

    // Rounded rectangle clip path for the sky
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padX + skyRadius, padTop);
    ctx.lineTo(padX + skySize - skyRadius, padTop);
    ctx.quadraticCurveTo(padX + skySize, padTop, padX + skySize, padTop + skyRadius);
    ctx.lineTo(padX + skySize, padTop + skySize - skyRadius);
    ctx.quadraticCurveTo(padX + skySize, padTop + skySize, padX + skySize - skyRadius, padTop + skySize);
    ctx.lineTo(padX + skyRadius, padTop + skySize);
    ctx.quadraticCurveTo(padX, padTop + skySize, padX, padTop + skySize - skyRadius);
    ctx.lineTo(padX, padTop + skyRadius);
    ctx.quadraticCurveTo(padX, padTop, padX + skyRadius, padTop);
    ctx.closePath();
    ctx.clip();

    // 3. Sky Deep Cosmic Gradient
    const skyGrad = ctx.createRadialGradient(
      padX + skySize * 0.5,
      padTop + skySize * 0.45,
      0,
      padX + skySize * 0.5,
      padTop + skySize * 0.5,
      skySize * 0.72
    );
    skyGrad.addColorStop(0, '#161324');
    skyGrad.addColorStop(0.65, '#0D0C15');
    skyGrad.addColorStop(1, '#07060A');

    ctx.fillStyle = skyGrad;
    ctx.fillRect(padX, padTop, skySize, skySize);

    // 4. Draw Lit Constellation Lines
    const litLines = (sky?.lines || []).filter((l) => l && l.isLit);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(252, 228, 236, 0.62)';

    for (const line of litLines) {
      const x1 = padX + (line.from.x / 100) * skySize;
      const y1 = padTop + (line.from.y / 100) * skySize;
      const x2 = padX + (line.to.x / 100) * skySize;
      const y2 = padTop + (line.to.y / 100) * skySize;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 5. Draw Lit Stars
    const litPoints = (sky?.points || []).filter((p) => p && p.isLit);

    for (const point of litPoints) {
      const px = padX + (point.x / 100) * skySize;
      const py = padTop + (point.y / 100) * skySize;

      // 5.1 Soft outer atmospheric halo
      const haloGrad = ctx.createRadialGradient(px, py, 0, px, py, 28);
      haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      haloGrad.addColorStop(0.35, 'rgba(250, 212, 223, 0.65)');
      haloGrad.addColorStop(0.7, 'rgba(233, 135, 135, 0.22)');
      haloGrad.addColorStop(1, 'rgba(233, 135, 135, 0)');

      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fill();

      // 5.2 Mid-glow layer
      ctx.fillStyle = 'rgba(250, 210, 220, 0.55)';
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();

      // 5.3 Core (Diamond star sparkle for anchor, or smooth circle for body)
      if (point.role === 'anchor') {
        const size = 13;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        // 4-point diamond star
        ctx.moveTo(px, py - size);
        ctx.quadraticCurveTo(px, py, px + size, py);
        ctx.quadraticCurveTo(px, py, px, py + size);
        ctx.quadraticCurveTo(px, py, px - size, py);
        ctx.quadraticCurveTo(px, py, px, py - size);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5.4 Bright pinpoint glint center
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Empty Sky Text if 0 stars
    if (litPoints.length === 0) {
      ctx.fillStyle = 'rgba(142, 133, 148, 0.8)';
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Здесь будет ваша история.', padX + skySize / 2, padTop + skySize / 2);
    }

    // Restore clip path
    ctx.restore();

    // 7. Subtle Photo Border inside Polaroid frame
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX + skyRadius, padTop);
    ctx.lineTo(padX + skySize - skyRadius, padTop);
    ctx.quadraticCurveTo(padX + skySize, padTop, padX + skySize, padTop + skyRadius);
    ctx.lineTo(padX + skySize, padTop + skySize - skyRadius);
    ctx.quadraticCurveTo(padX + skySize, padTop + skySize, padX + skySize - skyRadius, padTop + skySize);
    ctx.lineTo(padX + skyRadius, padTop + skySize);
    ctx.quadraticCurveTo(padX, padTop + skySize, padX, padTop + skySize - skyRadius);
    ctx.lineTo(padX, padTop + skyRadius);
    ctx.quadraticCurveTo(padX, padTop, padX + skyRadius, padTop);
    ctx.closePath();
    ctx.stroke();

    // 8. Bottom Section: Minimalist Polaroid Caption & Official OURS Logo
    const bottomCenterY = padTop + skySize + (height - (padTop + skySize)) / 2;

    // 8.1 "Наше небо" Title
    ctx.fillStyle = '#343033';
    ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Наше небо', width / 2, bottomCenterY - 24);

    // 8.2 Official OURS Logo: Exact original PNG asset from single source URL
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = OURS_LOGO_URL;
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      setTimeout(resolve, 600);
    });

    const logoRenderSize = 160;
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(
        logoImg,
        width / 2 - logoRenderSize / 2,
        bottomCenterY - 14,
        logoRenderSize,
        logoRenderSize
      );
    }

    // 9. Trigger File Download
    const monthStr = String(sky.month).padStart(2, '0');
    const fileName = `ours-our-sky-${sky.year}-${monthStr}.png`;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(true);
        }, 1000);
      }, 'image/png');
    });
  } catch (err) {
    console.error('[OURS] Failed to export sky polaroid:', err);
    return false;
  }
}
