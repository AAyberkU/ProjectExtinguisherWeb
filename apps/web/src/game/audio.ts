import { initAssets, resolveAssetUrl } from './assets';
import type { GameEvent } from './core';

const LARRY_MOVE_DURATION_MS = 220;

// Manifest aliases built from /art-source/audio by `npm run assets`.
const SOUND_ALIASES = {
  music: 'music',
  jump: 'sfx_jump',
  passed: 'sfx_passed',
  catapult: 'sfx_catapult',
  heal: 'sfx_heal',
  lose: 'sfx_lose',
  restart: 'sfx_restart',
  levelIntro: 'sfx_level_intro',
} as const;

const SFX_NAMES = ['jump', 'passed', 'catapult', 'heal', 'lose', 'restart', 'levelIntro'] as const;

type SoundName = (typeof SFX_NAMES)[number];
type SoundUrls = Readonly<Record<keyof typeof SOUND_ALIASES, string>>;
type AudioContextConstructor = new () => AudioContext;
type WindowWithLegacyAudioContext = Window &
  typeof globalThis &
  Readonly<{ webkitAudioContext?: AudioContextConstructor }>;

class GameAudioController {
  private music: HTMLAudioElement | null = null;
  private soundUrlsPromise: Promise<SoundUrls> | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly bufferPromises = new Map<SoundName, Promise<AudioBuffer>>();
  private readonly fallbackAudio = new Map<SoundName, HTMLAudioElement>();
  private audioContext: AudioContext | null = null;
  private scheduledSfx: number[] = [];
  private isPrimed = false;

  public constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.music?.pause();
        } else if (this.isPrimed) {
          void this.music?.play().catch(() => {
            // Autoplay might be blocked if unlocked state was lost
          });
        }
      });
    }
  }

  public prime() {
    if (this.isPrimed) {
      return;
    }

    this.isPrimed = true;
    void this.loadSoundUrls()
      .then((urls) => {
        this.createAudioElements(urls);

        for (const name of SFX_NAMES) {
          void this.loadBuffer(name).catch(() => {
            // Playback falls back to HTMLAudio when decoding fails.
          });
        }
      })
      .catch(() => {
        // The next gesture retries priming.
        this.isPrimed = false;
      });
  }

  public startMusic() {
    this.prime();
    void this.unlock();
    void this.music?.play().catch(() => {
      // Browsers may block autoplay until the first user gesture.
    });
  }

  private loadSoundUrls(): Promise<SoundUrls> {
    if (this.soundUrlsPromise === null) {
      this.soundUrlsPromise = initAssets()
        .then(() => {
          const entries = Object.entries(SOUND_ALIASES).map(([name, alias]) => [name, resolveAssetUrl(alias)]);

          return Object.fromEntries(entries) as SoundUrls;
        })
        .catch((error: unknown) => {
          this.soundUrlsPromise = null;
          throw error;
        });
    }

    return this.soundUrlsPromise;
  }

  private createAudioElements(urls: SoundUrls) {
    if (this.music !== null) {
      return;
    }

    this.music = new Audio(urls.music);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0.4;

    for (const name of SFX_NAMES) {
      const audio = new Audio(urls[name]);

      audio.preload = 'auto';
      this.fallbackAudio.set(name, audio);
    }
  }

  public async unlock() {
    const context = this.getAudioContext();

    if (context === null || context.state !== 'suspended') {
      return;
    }

    await context.resume().catch(() => {
      // A user gesture may still be required; the next gesture retries unlock.
    });
  }

  public play(soundName: SoundName) {
    const buffer = this.buffers.get(soundName);

    if (buffer !== undefined) {
      this.playBuffer(soundName, buffer);
      return;
    }

    void this.loadBuffer(soundName)
      .then((loadedBuffer) => this.playBuffer(soundName, loadedBuffer))
      .catch(() => this.playFallback(soundName));
  }

  public schedule(soundName: SoundName, delayMs: number) {
    void this.loadBuffer(soundName);

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
          this.schedule('passed', 0);
          break;
        case 'level-lost':
          this.schedule('lose', delayMs);
          break;
        default:
          break;
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext !== null) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext ?? (window as WindowWithLegacyAudioContext).webkitAudioContext;

    if (AudioContextClass === undefined) {
      return null;
    }

    this.audioContext = new AudioContextClass();

    return this.audioContext;
  }

  private loadBuffer(soundName: SoundName): Promise<AudioBuffer> {
    const existingBuffer = this.buffers.get(soundName);

    if (existingBuffer !== undefined) {
      return Promise.resolve(existingBuffer);
    }

    const existingPromise = this.bufferPromises.get(soundName);

    if (existingPromise !== undefined) {
      return existingPromise;
    }

    const context = this.getAudioContext();

    if (context === null) {
      return Promise.reject(new Error('Web Audio is not available.'));
    }

    const promise = this.loadSoundUrls()
      .then((urls) => fetch(urls[soundName], { cache: 'force-cache' }))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load sound '${soundName}'.`);
        }

        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        this.buffers.set(soundName, buffer);
        return buffer;
      })
      .finally(() => {
        this.bufferPromises.delete(soundName);
      });

    this.bufferPromises.set(soundName, promise);

    return promise;
  }

  private playBuffer(soundName: SoundName, buffer: AudioBuffer) {
    const context = this.getAudioContext();

    if (context === null) {
      this.playFallback(soundName);
      return;
    }

    if (context.state === 'suspended') {
      void context
        .resume()
        .then(() => {
          if (context.state === 'running') {
            this.startBufferSource(context, buffer);
          } else {
            this.playFallback(soundName);
          }
        })
        .catch(() => this.playFallback(soundName));
      return;
    }

    this.startBufferSource(context, buffer);
  }

  private startBufferSource(context: AudioContext, buffer: AudioBuffer) {
    const source = context.createBufferSource();

    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  }

  private playFallback(soundName: SoundName) {
    const baseAudio = this.fallbackAudio.get(soundName);
    const audio = baseAudio?.cloneNode(true);

    if (!(audio instanceof HTMLAudioElement)) {
      return;
    }

    audio.volume = 1;
    void audio.play().catch(() => {
      // SFX can be safely skipped if the browser rejects playback.
    });
  }
}

export const gameAudio = new GameAudioController();
