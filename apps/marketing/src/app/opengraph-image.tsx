import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Gustri — Run your cafe from your phone';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: 'linear-gradient(135deg, #f0fafb 0%, #d4eff4 40%, #aee0ea 75%, #7acad9 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '18px',
            background: '#367B8B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '40px',
            fontWeight: 700,
          }}
        >
          g
        </div>
        <div style={{ fontSize: '40px', fontWeight: 700, color: '#243d49' }}>gustri</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            fontSize: '68px',
            fontWeight: 700,
            color: '#132730',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
          }}
        >
          Run your cafe from your phone.
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#2d6878',
            lineHeight: 1.3,
            maxWidth: '900px',
          }}
        >
          POS, QR ordering, kitchen tickets, inventory — free for your first 100 orders/month.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div
          style={{
            background: '#367B8B',
            color: 'white',
            padding: '16px 28px',
            borderRadius: '14px',
            fontSize: '24px',
            fontWeight: 600,
          }}
        >
          Start Free
        </div>
        <div style={{ fontSize: '22px', color: '#2d6878' }}>
          No credit card · 5-minute setup · 20 languages
        </div>
      </div>
    </div>,
    { ...size },
  );
}
