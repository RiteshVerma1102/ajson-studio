import { describe, it, expect } from 'vitest';

/**
 * Calculates relative luminance according to WCAG 2.1 specifications.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates contrast ratio between two hex colors according to WCAG 2.1.
 * Ratio is (L1 + 0.05) / (L2 + 0.05) where L1 is lighter.
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens — WCAG 2.1 Color Contrast Audit', () => {
  describe('Dark Theme (Obsidian Slate)', () => {
    const bg0 = '#06080E';
    const bg1 = '#0B0F19';
    const bg2 = '#111827';
    const fg0 = '#FFFFFF';
    const fg1 = '#E5E7EB';
    const fg2 = '#9CA3AF';
    const accent = '#00F2FE';
    const accentContrast = '#06080E';

    it('primary text fg-0 on bg-0 and bg-1 satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(fg0, bg0)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(fg0, bg1)).toBeGreaterThanOrEqual(7.0);
    });

    it('secondary text fg-1 on surfaces satisfies WCAG AA (>= 4.5:1)', () => {
      expect(getContrastRatio(fg1, bg0)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(fg1, bg1)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(fg1, bg2)).toBeGreaterThanOrEqual(4.5);
    });

    it('muted text fg-2 satisfies minimum UI legibility ratio (>= 3:1)', () => {
      expect(getContrastRatio(fg2, bg0)).toBeGreaterThanOrEqual(3.0);
      expect(getContrastRatio(fg2, bg1)).toBeGreaterThanOrEqual(3.0);
    });

    it('brand accent satisfies high-visibility ratio against dark surfaces', () => {
      expect(getContrastRatio(accent, bg0)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(accent, bg1)).toBeGreaterThanOrEqual(4.5);
    });

    it('text on accent button (accent-contrast on accent) satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(accentContrast, accent)).toBeGreaterThanOrEqual(7.0);
    });
  });

  describe('Light Theme (Pure Canvas)', () => {
    const bg0 = '#F1F5F9';
    const bg1 = '#F8FAFC';
    const bg2 = '#FFFFFF';
    const fg0 = '#0F172A';
    const fg1 = '#1E293B';
    const fg2 = '#475569';
    const accent = '#0F766E';
    const accentContrast = '#FFFFFF';

    it('primary text fg-0 on surfaces satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(fg0, bg0)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(fg0, bg1)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(fg0, bg2)).toBeGreaterThanOrEqual(7.0);
    });

    it('secondary text fg-1 on surfaces satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(fg1, bg0)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(fg1, bg1)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(fg1, bg2)).toBeGreaterThanOrEqual(7.0);
    });

    it('muted text fg-2 satisfies WCAG AA (>= 4.5:1)', () => {
      expect(getContrastRatio(fg2, bg1)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(fg2, bg2)).toBeGreaterThanOrEqual(4.5);
    });

    it('brand accent satisfies UI readability on light surfaces (>= 3:1)', () => {
      expect(getContrastRatio(accent, bg2)).toBeGreaterThanOrEqual(3.0);
      expect(getContrastRatio(accent, bg1)).toBeGreaterThanOrEqual(3.0);
    });

    it('text on accent button (white on deep teal) satisfies WCAG AA (>= 4.5:1)', () => {
      expect(getContrastRatio(accentContrast, accent)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('High-Contrast Theme (Accessible High Visibility)', () => {
    const bg0 = '#000000';
    const bg1 = '#000000';
    const fg0 = '#FFFFFF';
    const fg1 = '#FFFFFF';
    const fg2 = '#E0E0E0';
    const accent = '#00F2FE';
    const accentContrast = '#000000';

    it('text contrast on pitch black satisfies maximum contrast (>= 15:1)', () => {
      expect(getContrastRatio(fg0, bg0)).toBeGreaterThanOrEqual(15.0);
      expect(getContrastRatio(fg1, bg1)).toBeGreaterThanOrEqual(15.0);
      expect(getContrastRatio(fg2, bg0)).toBeGreaterThanOrEqual(10.0);
    });

    it('accent on black satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(accent, bg0)).toBeGreaterThanOrEqual(7.0);
    });

    it('accent contrast text on accent satisfies WCAG AAA (>= 7:1)', () => {
      expect(getContrastRatio(accentContrast, accent)).toBeGreaterThanOrEqual(7.0);
    });
  });
});
