# Slideshow

Enkel bildspelsapp för iPad. Gränssnittet är på engelska. Välj album och bilder från Bilder-appen (även iCloud-bilder) eller bilder och mappar från Filer-appen (iCloud Drive), och visa dem sedan som ett bildspel i helskärm.

Byggd med Expo SDK 57, React Native och strikt TypeScript (`any` blockeras av ESLint).

## Funktioner

- **Album** från Bilder: visas i samma ordning som i albumet. Albumet läses in på nytt varje gång bildspelet startar, så nya bilder som läggs i albumet kommer med automatiskt.
- **Enskilda bilder** från Bilder: sparas som en referens till bilden. iCloud-bilder laddas ner när de ska visas.
- **Filer och mappar** från Filer-appen (iCloud Drive / På min iPad): bilderna kopieras in i appen, så bildspelet fungerar även utan nätverk. Bilderna i en mapp sorteras efter filnamn.
- **Kontrollpanel** (tryck på skärmen): spela/pausa, föregående/nästa, tid per bild (3–60 s), övergång (ingen, dissolve, slide i sidled, slide uppifrån, zoom, Ken Burns), loopa eller spela en gång, och i ordning eller blandat.
- **Exit** kräver att man håller inne knappen, så att besökare inte stänger bildspelet av misstag. Panelen döljs efter 8 sekunder.
- Skärmen hålls tänd under bildspelet och statusfältet döljs.
- Bilderna visas med `contain`: hela bilden syns alltid och får svarta kanter om formatet inte passar skärmen.
- Urvalet och inställningarna sparas mellan uppstarter.

## Struktur

```
App.tsx                      Växlar mellan startsidan och bildspelet, sparar urvalet och inställningarna
src/screens/SetupScreen.tsx  Val av album, bilder och mappar
src/screens/SlideshowScreen.tsx  Bildspelet: timer, ordning, lager
src/components/SlideLayer.tsx    En bild + dess övergångsanimation (Reanimated)
src/components/ControlPanel.tsx  Kontrollpanelen
src/lib/media.ts             Bilder-appen, Filer-appen och vilka bilder som ska visas
src/lib/storage.ts           Sparat läge (JSON i dokumentmappen) och kopierade bilder
src/lib/types.ts, order.ts, theme.ts
```

## Köra appen under utveckling

Appen använder inbyggda moduler som inte finns i Expo Go, så den behöver en **development build**.

```bash
npm install
npx expo run:ios --device      # kräver Xcode, iPaden ansluten med kabel
# eller i molnet utan Xcode:
npx eas-cli@latest build --profile development --platform ios
npx expo start
```

```bash
npm run typecheck
npm run lint
```

## Publicera på App Store

1. Byt `ios.bundleIdentifier` i `app.json` (nu `se.gwstudios.bildspel`, byt gärna till t.ex. `….slideshow`) till ett id som tillhör ditt utvecklarkonto.
2. Byt ut `assets/icon.png` (1024×1024, utan genomskinlighet) mot en riktig ikon.
3. Bygg och skicka in:
   ```bash
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios
   ```
4. I App Store Connect: appen är bara för iPad (`isTabletOnly`), så det räcker med iPad-skärmdumpar. Du behöver ändå en URL till en integritetspolicy. Ange att appen inte samlar in någon data.

## Tips för receptionen

Slå på **Guidad åtkomst** (på en engelskspråkig iPad: Settings → Accessibility → Guided Access). Trippelklicka sedan på topp- eller hemknappen när bildspelet är igång. Då går det inte att lämna appen, och iPaden kan inte låsas av misstag.

## Kända begränsningar

- Albumlistan visar egna album på toppnivå. Album som ligger i album-mappar, delade album och smarta album (till exempel Favoriter) visas inte. Enskilda bilder från dem kan väljas med "+ Photos".
- När man lägger till en hel mapp från iCloud Drive hoppas filer som inte är nedladdade till iPaden över, och appen säger hur många det gäller. Välj "Download Now" på mappen i Filer-appen först, eller välj bilderna med "+ Files / iCloud Drive", som laddar ner dem automatiskt.
