import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('splash', {
  onClose: (callback: () => void) => {
    ipcRenderer.on('splash:close', () => callback());
  },
});