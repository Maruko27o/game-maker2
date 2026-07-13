// Raw base SVG markup. We strip the outer <svg> wrapper so the inner groups can
// be injected into the single <svg> that HorseView builds (CLAUDE.md §3.3).
import rawSvg from '../../assets/horse_base.svg?raw';

function innerOf(svg: string): string {
  const open = svg.indexOf('>', svg.indexOf('<svg')) + 1;
  const close = svg.lastIndexOf('</svg>');
  return svg.slice(open, close).trim();
}

export const HORSE_BASE_INNER = innerOf(rawSvg);
export const VIEWBOX = '0 0 520 520';
