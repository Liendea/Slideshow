import { Directory, File, Paths } from 'expo-file-system';

import {
  DEFAULT_SETTINGS,
  DURATIONS,
  TRANSITIONS,
  type DurationSeconds,
  type SavedState,
  type SlideshowSettings,
  type Source,
  type TransitionType,
} from './types';

const STATE_FILE_NAME = 'slideshow-state.json';
const IMAGES_DIR_NAME = 'images';

function stateFile(): File {
  return new File(Paths.document, STATE_FILE_NAME);
}

/**
 * Copied images live in <documents>/images. Only file names are persisted because the absolute
 * path of the app container on iOS can change between app updates.
 */
export function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function storedImageFile(fileName: string): File {
  return new File(imagesDirectory(), fileName);
}

export function deleteStoredImages(fileNames: readonly string[]): void {
  for (const name of fileNames) {
    try {
      const file = storedImageFile(name);
      if (file.exists) file.delete();
    } catch {
      // A missing file is not worth interrupting the user for.
    }
  }
}

// ---------- Validation (the JSON on disk is untrusted `unknown`) ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDuration(value: unknown): value is DurationSeconds {
  return DURATIONS.some((duration) => duration === value);
}

function isTransition(value: unknown): value is TransitionType {
  return TRANSITIONS.some((transition) => transition.id === value);
}

function parseSource(value: unknown): Source | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case 'album':
      return typeof value.id === 'string' && typeof value.title === 'string'
        ? { kind: 'album', id: value.id, title: value.title }
        : null;
    case 'photo':
      return typeof value.uri === 'string' ? { kind: 'photo', uri: value.uri } : null;
    case 'file':
      return typeof value.fileName === 'string' ? { kind: 'file', fileName: value.fileName } : null;
    case 'folder':
      return typeof value.title === 'string' && isStringArray(value.fileNames)
        ? { kind: 'folder', title: value.title, fileNames: value.fileNames }
        : null;
    default:
      return null;
  }
}

function parseSettings(value: unknown): SlideshowSettings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  return {
    durationSeconds: isDuration(value.durationSeconds)
      ? value.durationSeconds
      : DEFAULT_SETTINGS.durationSeconds,
    loop: typeof value.loop === 'boolean' ? value.loop : DEFAULT_SETTINGS.loop,
    shuffle: typeof value.shuffle === 'boolean' ? value.shuffle : DEFAULT_SETTINGS.shuffle,
    transition: isTransition(value.transition) ? value.transition : DEFAULT_SETTINGS.transition,
  };
}

export function loadState(): SavedState {
  const empty: SavedState = { version: 1, sources: [], settings: DEFAULT_SETTINGS };
  try {
    const file = stateFile();
    if (!file.exists) return empty;
    const parsed: unknown = JSON.parse(file.textSync());
    if (!isRecord(parsed)) return empty;
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.map(parseSource).filter((source): source is Source => source !== null)
      : [];
    return { version: 1, sources, settings: parseSettings(parsed.settings) };
  } catch {
    return empty;
  }
}

export function saveState(state: SavedState): void {
  try {
    const file = stateFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(state));
  } catch {
    // Saving is best effort; the slideshow still works for this session.
  }
}
