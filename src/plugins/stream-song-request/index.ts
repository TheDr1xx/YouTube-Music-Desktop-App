import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { defaultConfig } from './config';
import { onMenu } from './menu';

export default createPlugin({
  name: () => t('plugins.stream-song-request.name'),
  description: () => t('plugins.stream-song-request.description'),
  restartNeeded: false,
  addedVersion: '3.12.0',
  config: defaultConfig,
  menu: onMenu,
  backend,
});
