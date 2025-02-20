import { app, BrowserWindow } from "electron";
import path from "path";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadURL(`file://${path.join(__dirname, "dist", "index.html")}`);
}

app.whenReady().then(() => {createWindow});
