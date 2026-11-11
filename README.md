# PlaceAR — location-based web AR (POC)

Creators put AR content on real places; players only see it when they are there.
This is the **phase 1 proof of concept** described in [`docs/AR_APP_PLAN.md`](docs/AR_APP_PLAN.md).

- **Web app**, works in Safari (iPhone) and Chrome (Android), no install.
- **No backend and no login**: everything is saved in the browser's `localStorage`.
- **Anchoring**: a GPS geofence unlocks a spot, and a photo of a flat object at the spot
  (painting, sign, poster) is the precise AR anchor ([MindAR](https://github.com/hiukim/mind-ar-js) image tracking).

## How it works

| Creator | Player |
|---|---|
| **Create** → name the experience → **Add spot** | **Explore** → experiences sorted by distance |
| Save your GPS location, set the unlock radius (or turn the check off indoors) | A spot unlocks inside its radius |
| Take a photo of the target object; the app rates how trackable it is | **Open camera** and point it at the object |
| Add 3D shapes, text and images; position them in the 3D editor | Content appears on the object; tap items for info |
| **Preview in AR**, then **Publish** | Found spots are ticked off |

Content positions are stored relative to the target photo (photo width = 1 unit), so
content stays attached to the object whatever its real size.

### Moving experiences between phones

Since there is no server yet, data stays in one browser. Use **Export** on the home screen
(or on an experience) and **Import** the `.json` file on the other phone.

### Testing away from the real place

Home → *Testing* → **Ignore location** unlocks every spot. You can also print or show the
target photo on a screen and point the camera at it.

## Development

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; camera works on localhost)
npm run dev:https    # https://<your-LAN-IP>:5173 for testing on a phone on the same Wi-Fi
                     # (self-signed certificate: accept the browser warning)
npm run build        # type-check + production build in dist/
```

Camera and GPS only work on **HTTPS** (or `localhost`). `dist/` can be hosted on any static
host (Netlify, Vercel, GitHub Pages). A GitHub Pages workflow is included
(`.github/workflows/deploy-pages.yml`): enable *Settings → Pages → Source: GitHub Actions*,
then it deploys on every push to `main` (or run it manually).

`.npmrc` sets `ignore-scripts=true` because `mind-ar` depends on the native `canvas` package,
which is only needed for Node and fails to build on many machines.

### Code map

| Path | What it does |
|---|---|
| `src/main.ts` | Hash router |
| `src/store.ts` | localStorage persistence, import/export, settings, player progress |
| `src/types.ts` | Data model (Experience → Spot → ContentItem) |
| `src/ar.ts` | AR session: camera + MindAR tracking + Three.js overlay |
| `src/target.ts` | Compiles target photos in the browser, quality score |
| `src/content.ts` | Builds 3D objects for content items, animations |
| `src/geo.ts` | GPS, distance, geofence helpers |
| `src/views/` | Screens: home, experience editor, spot editor (3D editor), explore, play, AR |

## Known limits of this POC

- `localStorage` holds about 5 MB per site; photos are downscaled to fit. Storage used is shown on the home screen.
- Target photos are compiled to tracking data on each device when a spot is opened (a few seconds), because the compiled data is too large for `localStorage`.
- Content must stay near its target object (within a few metres).
- No accounts, moderation or analytics yet — see the plan for phase 2+.
