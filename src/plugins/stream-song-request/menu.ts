import prompt from 'custom-electron-prompt';
import { clipboard, dialog, shell } from 'electron';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';

import { getPublicUrl } from './backend';
import { defaultConfig, type StreamSongRequestConfig } from './config';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export const onMenu = async ({
  getConfig,
  setConfig,
  window,
}: MenuContext<StreamSongRequestConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: t('plugins.stream-song-request.menu.port'),
      type: 'normal',
      async click() {
        const cfg = await getConfig();
        const out = await prompt(
          {
            title: t('plugins.stream-song-request.prompt.port.title'),
            label: t('plugins.stream-song-request.prompt.port.label'),
            value: cfg.port,
            type: 'counter',
            counterOptions: { minimum: 1024, maximum: 65535, multiFire: true },
            width: 380,
            ...promptOptions(),
          },
          window,
        );
        if (out) setConfig({ port: out });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.max-per-viewer'),
      type: 'normal',
      async click() {
        const cfg = await getConfig();
        const out = await prompt(
          {
            title: t('plugins.stream-song-request.prompt.max-per-viewer.title'),
            label: t('plugins.stream-song-request.prompt.max-per-viewer.label'),
            value: cfg.maxPerViewer,
            type: 'counter',
            counterOptions: { minimum: 0, maximum: 50, multiFire: true },
            width: 380,
            ...promptOptions(),
          },
          window,
        );
        if (out !== null && out !== undefined) setConfig({ maxPerViewer: out });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.cooldown'),
      type: 'normal',
      async click() {
        const cfg = await getConfig();
        const out = await prompt(
          {
            title: t('plugins.stream-song-request.prompt.cooldown.title'),
            label: t('plugins.stream-song-request.prompt.cooldown.label'),
            value: cfg.cooldownSeconds,
            type: 'counter',
            counterOptions: { minimum: 0, maximum: 3600, multiFire: true },
            width: 380,
            ...promptOptions(),
          },
          window,
        );
        if (out !== null && out !== undefined)
          setConfig({ cooldownSeconds: out });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.require-nickname'),
      type: 'checkbox',
      checked: config.requireNickname,
      click(item) {
        setConfig({ requireNickname: item.checked });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.block-explicit'),
      type: 'checkbox',
      checked: config.blockExplicit,
      click(item) {
        setConfig({ blockExplicit: item.checked });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.open-url'),
      type: 'normal',
      async click() {
        const cfg = await getConfig();
        shell.openExternal(`http://localhost:${cfg.port}`);
      },
    },
    {
      label: t('plugins.stream-song-request.menu.copy-public-url'),
      type: 'normal',
      async click() {
        const url = getPublicUrl();
        if (!url) {
          await dialog.showMessageBox(window, {
            type: 'warning',
            message: t('plugins.stream-song-request.dialog.tunnel-unavailable'),
          });
          return;
        }

        clipboard.writeText(url);
        await dialog.showMessageBox(window, {
          type: 'info',
          message: t('plugins.stream-song-request.dialog.url-copied'),
          detail: url,
        });
      },
    },
    {
      label: t('plugins.stream-song-request.menu.reset-defaults'),
      type: 'normal',
      click() {
        setConfig({
          port: defaultConfig.port,
          maxPerViewer: defaultConfig.maxPerViewer,
          requireNickname: defaultConfig.requireNickname,
          blockExplicit: defaultConfig.blockExplicit,
          cooldownSeconds: defaultConfig.cooldownSeconds,
        });
      },
    },
  ];
};
