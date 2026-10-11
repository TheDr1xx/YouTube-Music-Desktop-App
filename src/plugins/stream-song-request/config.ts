export interface StreamSongRequestConfig {
  enabled: boolean;
  port: number;
  /** Max songs a visitor can request during this plugin session (0 = unlimited) */
  maxPerViewer: number;
  /** Require viewers to type a nickname (prevents truly anonymous spam) */
  requireNickname: boolean;
  /** Block explicit/age-restricted content (if YouTube flags it) */
  blockExplicit: boolean;
  /** Cooldown in seconds between requests per IP */
  cooldownSeconds: number;
}

export const defaultConfig: StreamSongRequestConfig = {
  enabled: false,
  port: 7846,
  maxPerViewer: 3,
  requireNickname: true,
  blockExplicit: false,
  cooldownSeconds: 60,
};
