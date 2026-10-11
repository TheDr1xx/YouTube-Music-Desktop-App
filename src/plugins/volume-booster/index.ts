import prompt from 'custom-electron-prompt';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';
import { createPlugin } from '@/utils';

import type { MenuContext } from '@/types/contexts';

export type VolumeBoosterPluginConfig = {
  enabled: boolean;
  multiplier: number;
};

const MULTIPLIER_PRESETS = [1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

let currentGainNode: GainNode | null = null;
let currentAudioSource: MediaElementAudioSourceNode | null = null;
let currentAudioContext: AudioContext | null = null;

const applyGain = (
  audioSource: MediaElementAudioSourceNode | null,
  audioContext: AudioContext | null,
  multiplier: number,
) => {
  if (!audioSource || !audioContext) return;

  if (!currentGainNode) {
    try {
      currentGainNode = audioContext.createGain();
      audioSource.connect(currentGainNode);
      currentGainNode.connect(audioContext.destination);
    } catch (err) {
      console.error('[VolumeBooster] Failed to create or connect gain node:', err);
      return;
    }
  }

  // Smoothly transition gain to prevent clicks/pops
  try {
    currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    currentGainNode.gain.setValueAtTime(
      currentGainNode.gain.value,
      audioContext.currentTime,
    );
    currentGainNode.gain.linearRampToValueAtTime(
      multiplier,
      audioContext.currentTime + 0.05,
    );
  } catch {
    currentGainNode.gain.value = multiplier;
  }
};

const removeGain = () => {
  if (currentGainNode) {
    try {
      currentGainNode.disconnect();
    } catch {
      // ignore
    }
    currentGainNode = null;
  }
};

const handleAudioCanPlay = (
  event: CustomEvent<Compressor>,
  config: VolumeBoosterPluginConfig,
) => {
  currentAudioSource = event.detail.audioSource;
  currentAudioContext = event.detail.audioContext;
  applyGain(currentAudioSource, currentAudioContext, config.multiplier ?? 2.0);
};

let boundHandler: ((event: CustomEvent<Compressor>) => void) | null = null;

export default createPlugin<
  unknown,
  unknown,
  unknown,
  VolumeBoosterPluginConfig
>({
  name: () => t('plugins.volume-booster.name'),
  description: () => t('plugins.volume-booster.description'),
  restartNeeded: false,
  addedVersion: '3.12.0',
  config: {
    enabled: false,
    multiplier: 2.0,
  },
  menu: async ({
    getConfig,
    setConfig,
    window,
  }: MenuContext<VolumeBoosterPluginConfig>) => {
    const config = await getConfig();

    const promptCustomMultiplier = async () => {
      const output = await prompt(
        {
          title: t('plugins.volume-booster.prompt.title'),
          label: t('plugins.volume-booster.prompt.label'),
          value: String(config.multiplier ?? 2.0),
          type: 'input',
          ...promptOptions(),
        },
        window,
      );

      if (output) {
        const val = parseFloat(output);
        if (!isNaN(val) && val >= 1.0 && val <= 10.0) {
          setConfig({ multiplier: Number(val.toFixed(2)) });
        }
      }
    };

    return [
      ...MULTIPLIER_PRESETS.map((preset) => ({
        label: t('plugins.volume-booster.menu.multiplier', {
          multiplier: preset,
          percent: Math.round(preset * 100),
        }),
        type: 'radio' as const,
        checked: config.multiplier === preset,
        click() {
          setConfig({ multiplier: preset });
        },
      })),
      {
        label: t('plugins.volume-booster.menu.custom-multiplier'),
        type: 'normal' as const,
        click() {
          promptCustomMultiplier();
        },
      },
    ];
  },
  renderer: {
    async start({ getConfig }) {
      const config = await getConfig();

      boundHandler = (event: CustomEvent<Compressor>) => {
        handleAudioCanPlay(event, config);
      };

      document.addEventListener('peard:audio-can-play', boundHandler, {
        passive: true,
      });

      if (currentAudioSource && currentAudioContext) {
        applyGain(
          currentAudioSource,
          currentAudioContext,
          config.multiplier ?? 2.0,
        );
      }
    },
    async onConfigChange(newConfig) {
      if (currentAudioSource && currentAudioContext) {
        applyGain(
          currentAudioSource,
          currentAudioContext,
          newConfig.multiplier ?? 2.0,
        );
      }
    },
    stop() {
      if (boundHandler) {
        document.removeEventListener('peard:audio-can-play', boundHandler);
        boundHandler = null;
      }
      removeGain();
    },
  },
});
