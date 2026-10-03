import fs, { promises } from 'node:fs';
import path from 'node:path';

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, net } from 'electron';
import * as z from 'zod';

let blocker: ElectronBlocker | undefined;

const TbSourcesSchema = z.object({
  tb: z.array(z.string()),
});

export const loadTrackerBlockerEngine = async (
  session?: Electron.Session,
  cache: boolean = true,
  additionalBlockLists: string[] = [],
  disableDefaultLists: boolean | unknown[] = false,
) => {
  // Only use cache if no additional blocklists are passed
  const cacheDirectory = path.join(app.getPath('userData'), 'tb_cache');
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory);
  }
  
  const binPath = path.join(cacheDirectory, 'tb-engine.bin');
  if (fs.existsSync(binPath)) {
    const stats = fs.statSync(binPath);
    const now = new Date().getTime();
    if (now - stats.mtime.getTime() >= 24 * 60 * 60 * 1000) {
      fs.unlinkSync(binPath); // Force update every 24h
    }
  }

  const cachingOptions =
    cache && additionalBlockLists.length === 0
      ? {
          path: binPath,
          read: promises.readFile,
          write: promises.writeFile,
        }
      : undefined;

  const lists = [
    ...((disableDefaultLists && !Array.isArray(disableDefaultLists)) ||
    (Array.isArray(disableDefaultLists) && disableDefaultLists.length > 0)
      ? []
      : ['https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt']),
    ...additionalBlockLists,
  ];

  try {
    blocker = await ElectronBlocker.fromLists(
      (url: string) => net.fetch(url),
      lists,
      {
        enableCompression: true,
        // When generating the engine for caching, do not load network filters
        // So that enhancing the session works as expected
        // Allowing to define multiple webRequest listeners
        loadNetworkFilters: session !== undefined,
      },
      cachingOptions,
    );
    if (session) {
      blocker.enableBlockingInSession(session);
    }
  } catch (error) {
    console.error('Error loading blocker engine', error);
  }
};

export const unloadTrackerBlockerEngine = (session: Electron.Session) => {
  if (blocker) {
    blocker.disableBlockingInSession(session);
  }
};

export const isBlockerEnabled = (session: Electron.Session) =>
  blocker !== undefined && blocker.isBlockingEnabled(session);
