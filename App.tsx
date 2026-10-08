import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resolveSlides } from './src/lib/media';
import { loadState, saveState } from './src/lib/storage';
import type { SavedState, Slide, SlideshowSettings, Source } from './src/lib/types';
import { SetupScreen } from './src/screens/SetupScreen';
import { SlideshowScreen } from './src/screens/SlideshowScreen';

export default function App() {
  const [saved, setSaved] = useState<SavedState>(loadState);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [starting, setStarting] = useState(false);

  const persist = (next: SavedState) => {
    setSaved(next);
    saveState(next);
  };

  const changeSources = (sources: Source[]) => persist({ ...saved, sources });
  const changeSettings = (settings: SlideshowSettings) => persist({ ...saved, settings });

  const start = async () => {
    setStarting(true);
    try {
      const resolved = await resolveSlides(saved.sources);
      if (resolved.length === 0) {
        Alert.alert('No photos', 'The selected albums and folders don’t contain any photos right now.');
      } else {
        setSlides(resolved);
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {slides ? (
        <SlideshowScreen
          slides={slides}
          settings={saved.settings}
          onChangeSettings={changeSettings}
          onExit={() => setSlides(null)}
        />
      ) : (
        <SetupScreen
          sources={saved.sources}
          onChangeSources={changeSources}
          onStart={() => void start()}
          starting={starting}
        />
      )}
    </SafeAreaProvider>
  );
}
