const path = require('node:path');
function assetPath(root, address) {
  const u = new URL(address);
  if (u.protocol !== 'leaf:' || u.host !== 'app') throw Error('Invalid origin');
  const name = decodeURIComponent(u.pathname);
  if (name.includes('\\') || name.includes('\0')) throw Error('Invalid path');
  const target = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!target.startsWith(path.resolve(root) + path.sep)) throw Error('Invalid path');
  return target;
}
function fileName(name, suffix) {
  const clean = String(name || 'LEAF-Presentation')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 100);
  return (clean || 'LEAF-Presentation') + suffix;
}
module.exports = { assetPath, fileName };
