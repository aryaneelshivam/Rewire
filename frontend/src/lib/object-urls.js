// One object URL per local File, created on first use and released when the file leaves the screen.
const urls = new WeakMap();

export function urlFor(file) {
  if (!urls.has(file)) urls.set(file, URL.createObjectURL(file));
  return urls.get(file);
}

export function releaseUrl(file) {
  const url = urls.get(file);
  if (url) { URL.revokeObjectURL(url); urls.delete(file); }
}
