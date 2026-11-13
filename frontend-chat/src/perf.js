/**
 * Chrome on Windows struggles with this look: frosted-glass blur (backdrop-filter) and a window-fixed gradient are
 * expensive there, above all when Chrome has graphics acceleration off and draws on the processor. On that pairing
 * only, the page runs "lite": no blur (slightly more solid panels instead) and the gradient on its own layer that
 * never repaints. Everything else, Peek included, is unchanged.
 *
 * `?lite=1` or `?lite=0` in the address forces it either way, to compare.
 */
function isWindowsChrome() {
  const data = navigator.userAgentData;
  if (data?.brands?.length) {
    return data.platform === 'Windows' && data.brands.some(b => b.brand === 'Google Chrome');
  }
  const ua = navigator.userAgent;
  return /Windows/.test(ua) && /Chrome\//.test(ua) && !/Edg\/|OPR\/|Brave/.test(ua);
}

const force = new URLSearchParams(window.location.search).get('lite');
export const LITE = force === '1' ? true : force === '0' ? false : isWindowsChrome();
if (LITE) document.documentElement.dataset.perf = 'lite';
