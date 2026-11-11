// Chart marks get their paint from CSS-module classes and custom properties, which do not survive the
// export's clone of SVG elements. Copy the resolved paint onto each SVG element for the moment of capture.
const SVG_PAINT = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'visibility'];
export function inlineSvgPaint(root) {
  const saved = [];
  root.querySelectorAll('svg, svg *').forEach(el => {
    const before = el.getAttribute('style');
    const cs = getComputedStyle(el);
    saved.push([el, before]);
    el.setAttribute('style', `${before ?? ''};${SVG_PAINT.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')}`);
  });
  return () => saved.forEach(([el, before]) => (before === null ? el.removeAttribute('style') : el.setAttribute('style', before)));
}
