import { Image } from 'expo-image';
import { presentPermissionsPicker } from 'expo-media-library';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  listAlbums,
  pickFiles,
  pickFolder,
  pickPhotos,
  requestLibraryAccess,
  sourceKey,
  type AlbumInfo,
  type LibraryAccess,
} from '../lib/media';
import { deleteStoredImages, storedImageFile } from '../lib/storage';
import { colors, radius } from '../lib/theme';
import type { Source } from '../lib/types';

interface Props {
  sources: Source[];
  onChangeSources: (sources: Source[]) => void;
  onStart: () => void;
  starting: boolean;
}

export function SetupScreen({ sources, onChangeSources, onStart, starting }: Props) {
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<LibraryAccess | null>(null);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    requestLibraryAccess()
      .then(async (result) => {
        const list = result === 'denied' ? [] : await listAlbums();
        if (cancelled) return;
        setAccess(result);
        setAlbums(list);
      })
      .catch(() => {
        if (!cancelled) setAccess('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selectedAlbumIds = useMemo(
    () => new Set(sources.flatMap((s) => (s.kind === 'album' ? [s.id] : []))),
    [sources],
  );

  const otherSources = sources.filter((s) => s.kind !== 'album');

  const imageCount = useMemo(() => {
    const albumCounts = new Map(albums.map((a) => [a.id, a.imageCount]));
    return sources.reduce((sum, s) => {
      switch (s.kind) {
        case 'album':
          return sum + (albumCounts.get(s.id) ?? 0);
        case 'folder':
          return sum + s.fileNames.length;
        default:
          return sum + 1;
      }
    }, 0);
  }, [albums, sources]);

  const toggleAlbum = (album: AlbumInfo) => {
    if (selectedAlbumIds.has(album.id)) {
      onChangeSources(sources.filter((s) => !(s.kind === 'album' && s.id === album.id)));
    } else {
      onChangeSources([...sources, { kind: 'album', id: album.id, title: album.title }]);
    }
  };

  const removeSource = (source: Source) => {
    if (source.kind === 'file') deleteStoredImages([source.fileName]);
    if (source.kind === 'folder') deleteStoredImages(source.fileNames);
    const key = sourceKey(source);
    onChangeSources(sources.filter((s) => sourceKey(s) !== key));
  };

  const clearAll = () => {
    Alert.alert('Clear selection?', 'All selected albums, photos and folders will be removed from the slideshow.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          for (const s of sources) {
            if (s.kind === 'file') deleteStoredImages([s.fileName]);
            if (s.kind === 'folder') deleteStoredImages(s.fileNames);
          }
          onChangeSources([]);
        },
      },
    ]);
  };

  const runPicker = async (picker: () => Promise<Source[]>) => {
    setBusy(true);
    try {
      const added = await picker();
      if (added.length > 0) onChangeSources([...sources, ...added]);
    } catch {
      Alert.alert('Something went wrong', 'The photos couldn’t be added. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const addFolder = () =>
    runPicker(async () => {
      const { source, notDownloadedCount } = await pickFolder();
      if (notDownloadedCount > 0) {
        Alert.alert(
          'Some photos are only in iCloud',
          `${notDownloadedCount} ${notDownloadedCount === 1 ? 'file isn’t' : 'files aren’t'} downloaded to this iPad and ${notDownloadedCount === 1 ? 'was' : 'were'} skipped. ` +
            'Open the Files app, press and hold the folder, choose "Download Now", then add the folder again.',
        );
      }
      return source ? [source] : [];
    });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Slideshow</Text>
          {sources.length > 0 && (
            <Pressable onPress={clearAll} hitSlop={12}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* ---------- Albums ---------- */}
        <Text style={styles.sectionTitle}>Albums in Photos</Text>
        {access === null && <ActivityIndicator color={colors.textMuted} style={styles.spinner} />}
        {access === 'denied' && (
          <Notice
            text="The app needs access to Photos to show your albums."
            action="Open Settings"
            onPress={() => void Linking.openSettings()}
          />
        )}
        {access === 'limited' && (
          <Notice
            text="The app only has access to some photos. Allow access to all photos to see every album."
            action="Change"
            onPress={() =>
              void presentPermissionsPicker().then(() => setReloadToken((n) => n + 1))
            }
          />
        )}
        {access !== null && access !== 'denied' && albums.length === 0 && (
          <Text style={styles.muted}>No albums with photos were found.</Text>
        )}
        <View style={styles.grid}>
          {albums.map((album) => {
            const selected = selectedAlbumIds.has(album.id);
            return (
              <Pressable
                key={album.id}
                onPress={() => toggleAlbum(album)}
                style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}
              >
                <View style={[styles.albumCover, selected && styles.albumCoverSelected]}>
                  {album.coverUri && (
                    <Image source={album.coverUri} style={StyleSheet.absoluteFill} contentFit="cover" />
                  )}
                  {selected && (
                    <View style={styles.check}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.albumTitle} numberOfLines={1}>
                  {album.title}
                </Text>
                <Text style={styles.muted}>{photoCount(album.imageCount)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ---------- Individual images & folders ---------- */}
        <Text style={styles.sectionTitle}>Individual photos and folders</Text>
        <View style={styles.buttonRow}>
          <SecondaryButton label="+ Photos" onPress={() => void runPicker(pickPhotos)} disabled={busy} />
          <SecondaryButton
            label="+ Files / iCloud Drive"
            onPress={() => void runPicker(pickFiles)}
            disabled={busy}
          />
          <SecondaryButton label="+ Folder" onPress={() => void addFolder()} disabled={busy} />
          {busy && <ActivityIndicator color={colors.textMuted} />}
        </View>

        <View style={styles.grid}>
          {otherSources.map((source) => (
            <SourceTile key={sourceKey(source)} source={source} onRemove={() => removeSource(source)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable
          disabled={imageCount === 0 || starting}
          onPress={onStart}
          style={({ pressed }) => [
            styles.startButton,
            (imageCount === 0 || starting) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {starting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.startLabel}>
              {imageCount === 0 ? 'Choose photos to start' : `Start slideshow · ${photoCount(imageCount)}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SourceTile({ source, onRemove }: { source: Source; onRemove: () => void }) {
  const preview =
    source.kind === 'photo'
      ? source.uri
      : source.kind === 'file'
        ? storedImageFile(source.fileName).uri
        : source.kind === 'folder' && source.fileNames[0]
          ? storedImageFile(source.fileNames[0]).uri
          : null;

  return (
    <View style={styles.tile}>
      <View style={styles.tileImage}>
        {preview && <Image source={preview} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {source.kind === 'folder' && (
          <View style={styles.folderBadge}>
            <Text style={styles.folderBadgeText} numberOfLines={1}>
              📁 {source.title} · {source.fileNames.length}
            </Text>
          </View>
        )}
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.remove} accessibilityLabel="Remove">
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const style = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.secondaryButton,
    disabled && styles.disabled,
    pressed && styles.pressed,
  ];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

function Notice({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{text}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.noticeAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function photoCount(count: number): string {
  return count === 1 ? '1 photo' : `${count} photos`;
}

const TILE = 150;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 32, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: -0.5 },
  clear: { color: colors.danger, fontSize: 17 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 36,
    marginBottom: 16,
  },
  muted: { color: colors.textMuted, fontSize: 14 },
  spinner: { alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  albumCard: { width: TILE },
  albumCover: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  albumCoverSelected: { borderColor: colors.accent },
  albumTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: colors.accentText, fontWeight: '800', fontSize: 16 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 },
  secondaryButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  tile: { width: TILE, height: TILE },
  tileImage: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  folderBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  folderBadgeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  remove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.text, fontSize: 14 },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  noticeText: { color: colors.text, fontSize: 15, flex: 1 },
  noticeAction: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 32,
    paddingTop: 16,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLabel: { color: colors.accentText, fontSize: 19, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
