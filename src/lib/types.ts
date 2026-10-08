export const TRANSITIONS = [
  { id: 'none', label: 'None' },
  { id: 'dissolve', label: 'Dissolve' },
  { id: 'slideHorizontal', label: 'Slide sideways' },
  { id: 'slideVertical', label: 'Slide down' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'kenBurns', label: 'Ken Burns' },
] as const;

export type TransitionType = (typeof TRANSITIONS)[number]['id'];

export const DURATIONS = [3, 5, 10, 15, 30, 60] as const;

export type DurationSeconds = (typeof DURATIONS)[number];

export interface SlideshowSettings {
  durationSeconds: DurationSeconds;
  loop: boolean;
  shuffle: boolean;
  transition: TransitionType;
}

/** Album from the Photos app. Resolved to its current images every time the slideshow starts. */
export interface AlbumSource {
  kind: 'album';
  id: string;
  title: string;
}

/** Single photo from the Photos app, stored as a ph:// reference (iCloud Photos is downloaded on demand). */
export interface PhotoSource {
  kind: 'photo';
  uri: string;
}

/** Image picked from the Files app (iCloud Drive etc.), copied into the app's documents folder. */
export interface FileSource {
  kind: 'file';
  fileName: string;
}

/** Folder picked from the Files app; its images are copied into the app's documents folder. */
export interface FolderSource {
  kind: 'folder';
  title: string;
  fileNames: string[];
}

export type Source = AlbumSource | PhotoSource | FileSource | FolderSource;

export interface SavedState {
  version: 1;
  sources: Source[];
  settings: SlideshowSettings;
}

export interface Slide {
  key: string;
  uri: string;
}

export const DEFAULT_SETTINGS: SlideshowSettings = {
  durationSeconds: 5,
  loop: true,
  shuffle: false,
  transition: 'dissolve',
};
