module.exports = {
  packagerConfig: { asar: true, executableName: 'LEAF-Presentations',
    ignore: [/^\/out(?:\/|$)/, /^\/forge\.config\.cjs$/, /^\/package-lock\.json$/] },
  makers: [{ name: '@electron-forge/maker-squirrel', config: {
    name: 'leaf_presentations', authors: 'LEAF Properties & Partners',
    description: 'LEAF property presentation editor', setupExe: 'LEAF-Presentations-Setup.exe'
  } }]
};
