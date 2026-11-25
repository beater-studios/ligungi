import { useMemo } from 'preact/hooks';
import { qrMatrix } from './qrEncoder.ts';

/** Light border around the code, in modules, that scanners need to find it. */
const QUIET_ZONE = 4;

/** A QR code drawn as SVG: always dark on white with its quiet zone, as scanners expect, whatever the site theme. */
export const QrCode = ({ text, label }: { text: string; label: string }) => {
  const { path, size } = useMemo(() => {
    const matrix = qrMatrix(text);
    let d = '';
    matrix.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }),
    );
    return { path: d, size: matrix.length + 2 * QUIET_ZONE };
  }, [text]);
  return (
    <svg class="ligungi-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
};
