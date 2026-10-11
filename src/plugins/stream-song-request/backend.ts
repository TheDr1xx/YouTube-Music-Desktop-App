import { randomBytes } from 'node:crypto';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import localtunnel from 'localtunnel';

import { getSongControls } from '@/providers/song-controls';
import { createBackend } from '@/utils';

import { page } from './page';

import type { StreamSongRequestConfig } from './config';
import type { BackendContext } from '@/types/contexts';

type VisitorState = {
  lastRequest: number;
  lastSearch: number;
  requestCount: number;
};

const isVideoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]{11}$/.test(value);

const getVisitorAddress = (headers: Headers) =>
  headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  headers.get('x-real-ip') ||
  'local-visitor';

const collectVideoIds = (
  value: unknown,
  ids = new Map<string, { searchedAt: number; explicit: boolean }>(),
  inheritedExplicit = false,
): Map<string, { searchedAt: number; explicit: boolean }> => {
  if (!value || typeof value !== 'object') return ids;

  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoIds(item, ids, inheritedExplicit));
    return ids;
  }

  const explicit =
    inheritedExplicit ||
    Object.entries(value).some(
      ([key, child]) =>
        (key.toLowerCase().includes('explicit') && child === true) ||
        (key.toLowerCase().includes('badge') &&
          JSON.stringify(child).toLowerCase().includes('explicit')),
    );

  for (const [key, child] of Object.entries(value)) {
    if (key === 'videoId' && isVideoId(child)) {
      ids.set(child, { searchedAt: Date.now(), explicit });
    } else collectVideoIds(child, ids, explicit);
  }

  return ids;
};

export const backend = createBackend<
  {
    app?: Hono;
    server?: ReturnType<typeof serve>;
    accessToken?: string;
    publicUrl?: string;
    tunnel?: Awaited<ReturnType<typeof localtunnel>>;
    context?: BackendContext<StreamSongRequestConfig>;
    oldPort?: number;
    visitors: Map<string, VisitorState>;
    searchedVideoIds: Map<string, { searchedAt: number; explicit: boolean }>;
    startServer: (config: StreamSongRequestConfig) => Promise<void>;
    stopServer: () => void;
  },
  StreamSongRequestConfig
>({
  visitors: new Map(),
  searchedVideoIds: new Map(),

  async start(context) {
    this.context = context;
    const config = await context.getConfig();
    this.oldPort = config.port;
    await this.startServer(config);
  },

  stop() {
    this.stopServer();
    this.context = undefined;
  },

  async onConfigChange(config) {
    if (config.port === this.oldPort) return;

    this.oldPort = config.port;
    this.stopServer();
    await this.startServer(config);
  },

  async startServer(config) {
    const context = this.context;
    if (!context) return;

    const accessToken = randomBytes(24).toString('base64url');
    this.accessToken = accessToken;
    this.visitors.clear();
    this.searchedVideoIds.clear();

    const app = new Hono();
    const route = `/${accessToken}`;
    app.get('/favicon.ico', (ctx) => ctx.body(null, 204));
    app.get('/', (ctx) => ctx.redirect(route));
    app.get(route, (ctx) =>
      ctx.html(page.replaceAll('__ACCESS_TOKEN__', accessToken)),
    );

    app.get(`${route}/api/config`, async (ctx) => {
      const current = await context.getConfig();
      return ctx.json({
        requireNickname: current.requireNickname,
        blockExplicit: current.blockExplicit,
      });
    });

    app.post(`${route}/api/search`, async (ctx) => {
      let body: { query?: unknown };
      try {
        body = await ctx.req.json();
      } catch {
        return ctx.json({ error: 'Invalid request' }, 400);
      }

      if (
        typeof body.query !== 'string' ||
        !body.query.trim() ||
        body.query.length > 100
      ) {
        return ctx.json({ error: 'Enter a search query' }, 400);
      }

      const address = getVisitorAddress(ctx.req.raw.headers);
      const now = Date.now();
      const visitor = this.visitors.get(address) ?? {
        lastRequest: 0,
        lastSearch: 0,
        requestCount: 0,
      };
      if (now - visitor.lastSearch < 750) {
        return ctx.json({ error: 'Wait a moment before searching again' }, 429);
      }
      visitor.lastSearch = now;
      this.visitors.set(address, visitor);

      try {
        const result = await getSongControls(context.window).search(
          body.query.trim(),
        );
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        for (const [id, metadata] of collectVideoIds(data)) {
          this.searchedVideoIds.set(id, metadata);
        }
        if (this.searchedVideoIds.size > 1500) {
          for (const [id, metadata] of this.searchedVideoIds) {
            if (
              now - metadata.searchedAt > 60 * 60 * 1000 ||
              this.searchedVideoIds.size > 1500
            ) {
              this.searchedVideoIds.delete(id);
            }
          }
        }

        return ctx.json(data as object);
      } catch {
        return ctx.json({ error: 'Search is unavailable right now' }, 503);
      }
    });

    app.post(`${route}/api/queue`, async (ctx) => {
      let body: { videoId?: unknown; nickname?: unknown };
      try {
        body = await ctx.req.json();
      } catch {
        return ctx.json({ error: 'Invalid request' }, 400);
      }

      if (!isVideoId(body.videoId)) {
        return ctx.json(
          { error: 'Search for that song before requesting it' },
          400,
        );
      }

      const current = await context.getConfig();
      const searchedTrack = this.searchedVideoIds.get(body.videoId);
      if (
        !searchedTrack ||
        Date.now() - searchedTrack.searchedAt > 60 * 60 * 1000
      ) {
        return ctx.json(
          { error: 'Search for that song before requesting it' },
          400,
        );
      }
      if (current.blockExplicit && searchedTrack.explicit) {
        return ctx.json({ error: 'Explicit songs are not allowed' }, 403);
      }

      const nickname =
        typeof body.nickname === 'string' ? body.nickname.trim() : '';
      if (current.requireNickname && !nickname) {
        return ctx.json({ error: 'Enter your name first' }, 400);
      }
      if (nickname.length > 32) {
        return ctx.json({ error: 'Name must be 32 characters or fewer' }, 400);
      }

      const address = getVisitorAddress(ctx.req.raw.headers);
      const now = Date.now();
      const cooldownMilliseconds = current.cooldownSeconds * 1000;
      const visitor = this.visitors.get(address) ?? {
        lastRequest: 0,
        lastSearch: 0,
        requestCount: 0,
      };

      if (
        current.cooldownSeconds > 0 &&
        now - visitor.lastRequest < cooldownMilliseconds
      ) {
        const elapsedSinceRequest = now - visitor.lastRequest;
        const cooldownRemaining = cooldownMilliseconds - elapsedSinceRequest;
        const retryAfter = Math.ceil(cooldownRemaining / 1000);
        return ctx.json(
          { error: `Wait ${retryAfter}s before requesting again` },
          429,
        );
      }
      if (
        current.maxPerViewer > 0 &&
        visitor.requestCount >= current.maxPerViewer
      ) {
        return ctx.json(
          { error: 'You reached the request limit for this session' },
          429,
        );
      }

      const added = await getSongControls(context.window).addSongToQueueAndWait(
        body.videoId,
        'INSERT_AT_END',
      );
      if (!added) {
        return ctx.json({ error: 'YouTube Music could not add the song' }, 503);
      }

      visitor.lastRequest = now;
      visitor.requestCount += 1;
      this.visitors.set(address, visitor);
      if (this.visitors.size > 5000) {
        const oldestAddress = this.visitors.keys().next().value;
        if (oldestAddress) this.visitors.delete(oldestAddress);
      }

      return ctx.json({ ok: true });
    });

    this.app = app;
    this.server = serve({
      fetch: app.fetch,
      port: config.port,
      hostname: '127.0.0.1',
    });

    try {
      await new Promise<void>((resolve, reject) => {
        this.server?.once('listening', resolve);
        this.server?.once('error', reject);
      });
    } catch (error) {
      this.server?.close();
      this.server = undefined;
      console.error(
        '[YTMusic] Could not start stream song request server',
        error,
      );
      return;
    }

    localtunnel({
      port: config.port,
      local_host: '127.0.0.1',
    })
      .then((tunnel) => {
        if (this.accessToken !== accessToken) {
          tunnel.close();
          return;
        }

        this.tunnel = tunnel;
        this.publicUrl = `${tunnel.url}${route}`;
        tunnel.on('close', () => {
          if (this.tunnel === tunnel) this.publicUrl = undefined;
        });
        tunnel.on('error', (error) => {
          console.error('[YTMusic] Stream song request tunnel error', error);
          if (this.tunnel === tunnel) this.publicUrl = undefined;
        });
      })
      .catch((error: unknown) => {
        this.publicUrl = undefined;
        console.error(
          '[YTMusic] Could not create stream song request tunnel',
          error,
        );
      });
  },

  stopServer() {
    this.publicUrl = undefined;
    this.accessToken = undefined;
    this.searchedVideoIds.clear();
    this.visitors.clear();
    this.tunnel?.close();
    this.tunnel = undefined;
    this.server?.close();
    this.server = undefined;
  },
});

export const getPublicUrl = () => backend.publicUrl;
