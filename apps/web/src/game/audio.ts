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

const SFX_NAMES = ['jump', 'passed', 'catapult', 'heal', 'lose', 'restart', 'levelIntro'] as const;

type SoundName = (typeof SFX_NAMES)[number];
type AudioContextConstructor = new () => AudioContext;
type WindowWithLegacyAudioContext = Window &
  typeof globalThis &
  Readonly<{ webkitAudioContext?: AudioContextConstructor }>;

class GameAudioController {
  private readonly music = new Audio(SOUND_URLS.music);
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly bufferPromises = new Map<SoundName, Promise<AudioBuffer>>();
  private readonly fallbackAudio = new Map<SoundName, HTMLAudioElement>();
  private audioContext: AudioContext | null = null;
  private scheduledSfx: number[] = [];
  private isPrimed = false;

  public constructor() {
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0.4;

    for (const name of SFX_NAMES) {
      const audio = new Audio(SOUND_URLS[name]);

      audio.preload = 'auto';
      this.fallbackAudio.set(name, audio);
    }
  }

  public prime() {
    if (this.isPrimed) {
      return;
    }
    
    this.isPrimed = true;
    this.music.load();

    for (const audio of this.fallbackAudio.values()) {
      audio.load();
    }

    for (const name of SFX_NAMES) {
      void this.loadBuffer(name);
    }
  }

  public startMusic() {
    this.prime();
    void this.unlock();
    void this.music.play().catch(() => {
      // Browsers may block autoplay until the first user gesture.
    });
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

    const promise = fetch(SOUND_URLS[soundName], { cache: 'force-cache' })
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
