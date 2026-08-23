const { app, BrowserWindow, Menu, session, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Mandi Bolli Commission App',
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Allows local file downloads, blob URLs, and print previews
    },
    icon: path.join(__dirname, 'public/favicon.ico'),
  });

  // Handle native file downloads (PDF, JSON, CSV) in Electron
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // Default file name suggested by the app
    const fileName = item.getFilename();
    item.setSaveDialogOptions({
      title: 'Save File - Mandi Bolli App',
      defaultPath: path.join(app.getPath('downloads'), fileName),
    });
  });

  // Load the built SPA
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  // Ensure window.print() and popup print previews work natively in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 900,
        height: 950,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: false,
          javascript: true,
        },
      },
    };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

