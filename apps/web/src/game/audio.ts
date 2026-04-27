import type { GameEvent } from './core';

const LARRY_MOVE_DURATION_MS = 220;

const SOUND_URLS = {
  music: new URL('../../../../sound/music.wav', import.meta.url).href,
  jump: new URL('../../../../sound/jump.wav', import.meta.url).href,
  passed: new URL('../../../../sound/passed.mp3', import.meta.url).href,
  catapult: new URL('../../../../sound/catapult.wav', import.meta.url).href,
  heal: new URL('../../../../sound/heal.wav', import.meta.url).href,
  lose: new URL('../../../../sound/lose.wav', import.meta.url).href,
  restart: new URL('../../../../sound/restart.wav', import.meta.url).href,
  levelIntro: new URL('../../../../sound/levelIntro.wav', import.meta.url).href,
} as const;

type SoundName = Exclude<keyof typeof SOUND_URLS, 'music'>;

class GameAudioController {
  private readonly music = new Audio(SOUND_URLS.music);
  private scheduledSfx: number[] = [];

  public constructor() {
    this.music.loop = true;
    this.music.volume = 0.7;
  }

  public startMusic() {
    void this.music.play().catch(() => {
      // Browsers may block autoplay until the first user gesture.
    });
  }

  public play(soundName: SoundName) {
    const audio = new Audio(SOUND_URLS[soundName]);

    audio.volume = 1;
    void audio.play().catch(() => {
      // SFX can be safely skipped if the browser rejects playback.
    });
  }

  public schedule(soundName: SoundName, delayMs: number) {
    const timeout = window.setTimeout(() => {
      this.scheduledSfx = this.scheduledSfx.filter((candidate) => candidate !== timeout);
      this.play(soundName);
    }, Math.max(0, delayMs));

    this.scheduledSfx.push(timeout);
  }

  public cancelScheduledSfx() {
    for (const timeout of this.scheduledSfx) {
      window.clearTimeout(timeout);
    }

    this.scheduledSfx = [];
  }

  public scheduleGameplayEvents(events: readonly GameEvent[]) {
    let delayMs = 0;

    for (const event of events) {
      switch (event.type) {
        case 'larry-moved':
          this.schedule(event.source === 'catapult' ? 'catapult' : 'jump', delayMs);
          delayMs += LARRY_MOVE_DURATION_MS;
          break;
        case 'move-bonus-consumed':
          this.schedule('heal', delayMs);
          break;
        case 'level-won':
          this.schedule('passed', delayMs);
          break;
        case 'level-lost':
          this.schedule('lose', delayMs);
          break;
        default:
          break;
      }
    }
  }
}

export const gameAudio = new GameAudioController();
