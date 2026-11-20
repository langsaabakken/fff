# Fridthjof For Faen

Yatzy-variant for hytta, laget for mobil. Fra 1 til 4 spillere kan spille alene, sammen på én mobil, eller på hver sin mobil. Spillet trenger ingen konto og ingen egen server.

Spill på nett: https://langsaabakken.github.io/fridthjof-for-faen/

## Regler i korte trekk

- Fri yatzy med 5 rekker og gangetall (Rekke × 1 til × 5). Det er 20 kategorier og 100 omganger.
- De 10 første og de 5 siste omgangene spilles med 8 terninger. Resten spilles med 6.
- Hver spiller har maks 3 kast per omgang. Bare de 6 beste terningene teller.
- Bonus på 100 i hver rekke ved minst 84 i øvre del.
- Stiftsgården er 3+3, Værnes 4+2 og Strandstua 3+2. Fridthjof For Faen er 6 like og gir 100.

## Filer

| Fil | Hva den gjør |
| --- | --- |
| `index.html` | Siden: fjellbildet, lobbyen og spillflaten |
| `css/style.css` | Utseende med hyttetema, 3D-terninger, poengkort og poengtavle |
| `js/config.js` | **Alle regler og innstillinger**: kategorier, rekker, bonus, terningplan og hvilke lyder som brukes |
| `js/scoring.js` | Poengregning, uten noe med skjermen å gjøre |
| `js/sound.js` | Lydeffekter laget i nettleseren: fugl, gjøk, sau, ku, fisk og terninger |
| `js/dice3d.js` | 3D-terningene og kastanimasjonen |
| `js/game.js` | Spilltilstand, tur, kast og innføring |
| `js/net.js` | Flere mobiler via PeerJS (vert og gjester) |
| `js/ui.js` | Tegner banner, terninger, poengkort og poengtavle |
| `js/main.js` | Starter appen og kobler knapper til spillet |
| `vendor/peerjs.min.js` | PeerJS 1.5.5 (MIT-lisens) |

Skriptene lastes i rekkefølgen over, og alle deler navnerommet `window.FFF`.

## Slik utvider du spillet

- **Ny kategori:** Legg et nytt objekt i `FFF.categories` i `config.js`. Det trenger `label`, `max` og `score(dice, S)`. Hjelpefunksjonene `S` finnes i `scoring.js`. Brettet, poengtavla og antall omganger følger med automatisk. NB: Gamle lagrede spill passer da ikke lenger. Bytt derfor `storageKey` og `peerPrefix` i `config.js`.
- **Andre regler:** Endre `rows`, `multiplier`, `maxThrows`, `bestDice`, `upperBonus` eller `diceForRound` i `config.js`.
- **Ny lyd:** Legg en funksjon i `SOUNDS` i `sound.js`, og knytt den til en hendelse i `config.sounds`.
- **Ny hendelse:** `game.place()` returnerer en liste med hendelser (`zero`, `highScore`, `bonus`, `allSame`, `finished`). Lyd og feiring for dem styres i `main.js`.
- **Ny nettverksmelding:** Se kommentaren øverst i `net.js`.

## Lydene

| Hendelse | Lyd |
| --- | --- |
| Det blir din tur | Fuglekvitter |
| Du kaster | Terningrasling, og et «tok» når hver terning lander |
| God score (minst 70 % av maks) | Gjøken galer |
| Du stryker en rute (0 poeng) | Sauen breker |
| Bonus i en rekke | Kua rauter |
| 6 like (Fridthjof For Faen) | Fisken vaker |

Du kan også trykke på dyrene i fjellbildet. Lyden slås av og på med høyttalerknappen øverst til høyre.

## Publisere en ny versjon

Last opp alle filene og mappene til GitHub-repoet `langsaabakken/fridthjof-for-faen` med Add file › Upload files › Commit changes. GitHub Pages oppdaterer siden etter et par minutter.

Siden kan også åpnes direkte fra disken (`index.html`) for testing. Da spiller du på én mobil eller maskin.
