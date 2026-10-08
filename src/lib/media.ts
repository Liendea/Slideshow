import { Directory, File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Album, AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';

import { imagesDirectory, storedImageFile } from './storage';
import type { AlbumSource, FileSource, FolderSource, PhotoSource, Slide, Source } from './types';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'tif', 'tiff', 'bmp']);

export type LibraryAccess = 'all' | 'limited' | 'denied';

export async function requestLibraryAccess(): Promise<LibraryAccess> {
  const response = await requestPermissionsAsync();
  if (!response.granted) return 'denied';
  return response.accessPrivileges === 'limited' ? 'limited' : 'all';
}

export interface AlbumInfo {
  id: string;
  title: string;
  imageCount: number;
  coverUri: string | null;
}

async function albumImageUris(album: Album): Promise<string[]> {
  // No orderBy → Photos returns the images in the album's own order.
  const assets = await new Query()
    .album(album)
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .exeForMetadata();
  return assets.map((asset) => asset.id);
}

export async function listAlbums(): Promise<AlbumInfo[]> {
  const albums = await Album.getAll();
  const infos = await Promise.all(
    albums.map(async (album): Promise<AlbumInfo | null> => {
      try {
        const [title, uris] = await Promise.all([album.getTitle(), albumImageUris(album)]);
        return { id: album.id, title, imageCount: uris.length, coverUri: uris[0] ?? null };
      } catch {
        return null;
      }
    }),
  );
  return infos
    .filter((info): info is AlbumInfo => info !== null && info.imageCount > 0)
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

/** Individual photos from the Photos app (including iCloud Photos). */
export async function pickPhotos(): Promise<Source[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];

  const sources: Source[] = [];
  for (const asset of result.assets) {
    if (asset.assetId) {
      const photo: PhotoSource = { kind: 'photo', uri: `ph://${asset.assetId}` };
      sources.push(photo);
    } else {
      // No library reference (e.g. limited access): keep our own copy instead.
      const fileName = await copyIntoApp(new File(asset.uri), asset.fileName ?? 'photo.jpg');
      const file: FileSource = { kind: 'file', fileName };
      sources.push(file);
    }
  }
  return sources;
}

/** Images picked in the Files app (iCloud Drive, On My iPad, …). The picker downloads them for us. */
export async function pickFiles(): Promise<FileSource[]> {
  const result = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['image/*'] });
  if (result.canceled) return [];

  const sources: FileSource[] = [];
  for (const picked of result.result) {
    const fileName = await copyIntoApp(picked, picked.name);
    sources.push({ kind: 'file', fileName });
  }
  return sources;
}

export interface FolderPickResult {
  source: FolderSource | null;
  /** Files that only exist in iCloud and have not been downloaded to the iPad yet. */
  notDownloadedCount: number;
}

/** A whole folder from the Files app. Images are sorted by file name, as in Finder/Files. */
export async function pickFolder(): Promise<FolderPickResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return { source: null, notDownloadedCount: 0 }; // Cancelled
  }

  const files = directory.list().filter((entry): entry is File => entry instanceof File);
  // iCloud placeholders look like ".IMG_0001.jpg.icloud" until they are downloaded.
  const notDownloadedCount = files.filter((file) => file.name.endsWith('.icloud')).length;
  const images = files
    .filter((file) => IMAGE_EXTENSIONS.has(extensionOf(file.name)))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

  if (images.length === 0) return { source: null, notDownloadedCount };

  const fileNames: string[] = [];
  for (const image of images) {
    fileNames.push(await copyIntoApp(image, image.name));
  }
  return {
    source: { kind: 'folder', title: directory.name, fileNames },
    notDownloadedCount,
  };
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

let copyCounter = 0;

async function copyIntoApp(source: File, originalName: string): Promise<string> {
  const safeName = originalName.replace(/[^\w.-]+/g, '_');
  copyCounter += 1;
  const fileName = `${Date.now()}-${copyCounter}-${safeName}`;
  imagesDirectory();
  await source.copy(storedImageFile(fileName));
  return fileName;
}

/** Turns the saved sources into the flat, ordered list of images to show. */
export async function resolveSlides(sources: readonly Source[]): Promise<Slide[]> {
  const uriLists = await Promise.all(
    sources.map(async (source): Promise<string[]> => {
      switch (source.kind) {
        case 'album':
          try {
            return await albumImageUris(new Album(source.id));
          } catch {
            return []; // Album was deleted
          }
        case 'photo':
          return [source.uri];
        case 'file':
          return existingFileUris([source.fileName]);
        case 'folder':
          return existingFileUris(source.fileNames);
      }
    }),
  );
  return uriLists.flat().map((uri, index) => ({ key: `${index}:${uri}`, uri }));
}

function existingFileUris(fileNames: readonly string[]): string[] {
  return fileNames.map(storedImageFile).filter((file) => file.exists).map((file) => file.uri);
}

export function sourceKey(source: Source): string {
  switch (source.kind) {
    case 'album':
      return `album:${source.id}`;
    case 'photo':
      return `photo:${source.uri}`;
    case 'file':
      return `file:${source.fileName}`;
    case 'folder':
      return `folder:${source.fileNames[0] ?? source.title}`;
  }
}

export function isAlbumSource(source: Source): source is AlbumSource {
  return source.kind === 'album';
}
