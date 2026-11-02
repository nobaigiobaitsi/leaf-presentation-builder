const { app, BrowserWindow, protocol, ipcMain, dialog, session } = require('electron');
const { readFile, writeFile, stat } = require('node:fs/promises');
const path = require('node:path');
const { assetPath, fileName } = require('./helpers.cjs');
const MAX = 60 * 1024 * 1024;
let win,
  validateProject,
  operation = false;
protocol.registerSchemesAsPrivileged([
  { scheme: 'leaf', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
if (require('electron-squirrel-startup')) app.quit();
else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      ({ validateProject } = await import('./project.js'));
      protocol.handle('leaf', async req => {
        try {
          const target = assetPath(path.join(__dirname, 'dist'), req.url);
          const types = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.jpg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
          };
          return new Response(await readFile(target), {
            headers: { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }
          });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      });
      session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false)
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      // The app needs only packaged assets and embedded images, never remote requests.
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !['leaf:', 'data:', 'blob:'].includes(new URL(details.url).protocol) });
      });
      session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'"
            ]
          }
        })
      );
      function handle(channel, fn) {
        ipcMain.handle(channel, async (event, ...args) => {
          if (
            !win ||
            event.sender !== win.webContents ||
            event.senderFrame !== win.webContents.mainFrame ||
            !event.senderFrame.url.startsWith('leaf://app/')
          )
            throw Error('Invalid sender');
          if (operation) throw Error('Μια άλλη ενέργεια βρίσκεται σε εξέλιξη.');
          operation = true;
          try {
            return await fn(...args);
          } finally {
            operation = false;
          }
        });
      }
      handle('leaf:save', async (json, name) => {
        if (typeof json !== 'string' || Buffer.byteLength(json) > MAX)
          throw Error('Μη έγκυρο μέγεθος έργου.');
        validateProject(JSON.parse(json), { portable: true });
        const result = await dialog.showSaveDialog(win, {
          title: 'Αποθήκευση έργου',
          defaultPath: fileName(name, '.leaf.json'),
          filters: [{ name: 'LEAF project', extensions: ['json'] }]
        });
        if (result.canceled) return false;
        await writeFile(result.filePath, json, 'utf8');
        return true;
      });
      handle('leaf:open', async () => {
        const result = await dialog.showOpenDialog(win, {
          title: 'Άνοιγμα έργου',
          properties: ['openFile'],
          filters: [{ name: 'LEAF project', extensions: ['json'] }]
        });
        if (result.canceled) return null;
        const p = result.filePaths[0];
        if ((await stat(p)).size > MAX) throw Error('Το έργο ξεπερνά τα 60 MB.');
        const json = await readFile(p, 'utf8');
        if (Buffer.byteLength(json) > MAX) throw Error('Το έργο ξεπερνά τα 60 MB.');
        return validateProject(JSON.parse(json), { portable: true });
      });
      handle('leaf:pdf', async name => {
        const result = await dialog.showSaveDialog(win, {
          title: 'Αποθήκευση PDF',
          defaultPath: fileName(name, '.pdf'),
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (result.canceled) return false;
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        await writeFile(result.filePath, pdf);
        return true;
      });
      win = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 1050,
        minHeight: 720,
        title: 'LEAF Presentations',
        backgroundColor: '#163f32',
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true
        }
      });
      win.setMenu(null);
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', event => event.preventDefault());
      win.webContents.on('will-prevent-unload', event => {
        const response = dialog.showMessageBoxSync(win, {
          type: 'question',
          buttons: ['Παραμονή', 'Κλείσιμο χωρίς αποθήκευση'],
          defaultId: 0,
          cancelId: 0,
          message: 'Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί σε αρχείο έργου.'
        });
        if (response === 1) event.preventDefault();
      });
      await win.loadURL('leaf://app/index.html');
    })
    .catch(error => {
      dialog.showErrorBox('LEAF', error.message);
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
}
