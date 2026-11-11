# Plan: Location-Based AR App for Creators and Players

## 1. Core idea

A **creator** goes to a real place, places AR content there and publishes it as an experience. A **player** can only see and interact with that content when they physically stand at the same spot. Nothing is generated automatically and there is no global game map: every experience is made by a person, for a specific place.

### Decisions made

| Question | Decision |
|---|---|
| Setting | **Both** indoor (museums, venues) and outdoor (cities, trails) |
| Audience | **B2B**: museums, tourism boards, venues, event organisers |
| Who can create | **Any user** in the POC, since there is no authentication |
| Platform | **Web first**: a mobile web app opened from a link or QR code, no app-store install |

## 2. What web AR can and can't do (2026)

| Capability | Android (Chrome) | iOS (Safari) |
|---|---|---|
| Camera + image tracking (JS/WebAssembly, e.g. MindAR) | Yes | Yes |
| GPS + compass in the browser | Yes | Yes (compass needs a permission tap) |
| WebXR `immersive-ar` (world tracking, hit test) | Yes | **No** |
| Google Geospatial API / Cloud Anchors | **No** (native only) | **No** |
| Commercial web VPS (e.g. Immersal Web SDK) | Yes, paid | Yes, paid |

**Consequences:**

- Geospatial API and Cloud Anchors, which the native plan relied on, are not available on the web.
- GPS alone (5–15 m off, indoors worse) can't place content precisely.
- To work on both iOS and Android, indoors and outdoors, the POC uses **image targets** as the precise anchor.

## 3. Anchoring approach for the web POC

Each spot uses two layers:

1. **Place check (coarse): GPS geofence.** The player must be within the spot's radius to unlock it. The default is 50 m outdoors. Indoors GPS is unreliable, so the creator can set a larger radius (for example 150 m around the building) or turn the check off.
2. **Precise anchor: an image target.** The creator photographs something flat and fixed at the spot: a painting, a sign, a poster, a plaque or a mural. Content is placed **relative to that image**. When a player points their camera at the same object, the content appears exactly where the creator put it.

**Why this works well for B2B:**

- It works indoors and outdoors, on iOS and Android, with no install.
- Museums and venues already have natural targets (artworks, signage), or can print a branded marker or QR poster.
- The physical object is itself proof the player is on site. The GPS check is a second layer.

**Limits accepted for the POC:**

- Content must stay near the target, roughly within a few metres. It can't float freely across a large square.
- Targets need texture and detail. A plain white wall won't track. The editor shows a quality score for each photo.
- Someone could cheat using a photo of the target. That's acceptable for a POC, and the GPS check reduces it.

**Later, optional outdoor mode:** GPS + compass-anchored content (in the style of AR.js / LocAR.js) for large, loosely placed objects such as a giant arrow or a floating sign, where 5–15 m accuracy is acceptable.

## 4. POC scope

> **Status:** phase 1 is built (see `README.md`). For the first iteration there is **no backend**: all data is stored in the browser's `localStorage`, and experiences move between devices with JSON export/import. Supabase replaces this in the next iteration.

**No authentication.**

- No sign-up, login or accounts. Anyone can create and anyone can play.
- The home screen has two buttons: **Create** and **Explore**.
- Each browser gets a random device ID in local storage. It is saved as `creator_device_id` so the same browser can edit or delete its own experiences. It is not a security measure.
- Each experience also gets a secret **edit link** (`/edit/<id>?key=<edit_key>`), so a creator can continue editing on another device.
- The backend allows anonymous reads and writes, limited by row-level rules (only the edit key can modify an experience). This is acceptable for a POC only.

**In scope**

| Area | POC scope |
|---|---|
| Delivery | Mobile web app over HTTPS, shared by link or QR code |
| Experiences | Title, description, cover image, one or more spots (multi-spot trails come later) |
| Spot | GPS position + radius, plus one image target |
| Content per spot | Up to 5 items: 3D model (built-in library or GLB upload), text label, image, a short audio clip |
| Creator | Create on site from the phone: take the target photo, then place and adjust content in a live AR preview. Publish. |
| Player | List or map sorted by distance. Unlock in the geofence. Point the camera at the target to show the content. Tap items for interactions (play audio, show info). |
| Sharing | Each experience has a public link and a printable QR code for on-site posters |

**Out of scope for the POC:** authentication, organisations/teams, moderation, analytics, offline mode, quizzes and badges, VPS, native apps.

### Next up (planned, not built yet)

- **Share link with QR code.** A player scans a QR code or opens a link and the experience loads on their phone automatically, instead of passing a JSON file around. Target photos are too large to fit in a URL, so this needs a place to host the data: a small file host first, then the Supabase backend.
- **Target photo tips learned from field testing.** Target photos must be **cropped to just the flat object**. A photo that includes the wall, floor or surroundings fails to track when the player frames only the object. The creator flow now includes a crop step.

## 5. Tech stack

| Part | Choice | Why |
|---|---|---|
| Front end | **Vite + TypeScript**, plain or with a light framework (Preact/React) | Fast, small bundles, simple deploy |
| 3D | **Three.js** | Standard, works with MindAR, loads GLB |
| Image tracking | **MindAR** (open source, MIT) | Works on iOS and Android browsers. Can **compile targets in the browser**, so no server build step is needed. |
| Backend | **Supabase** (Postgres + Storage), anonymous access | Free tier, PostGIS for distance queries, file storage for images, models and compiled `.mind` targets |
| Hosting | Vercel or Netlify (HTTPS is required for camera access) | Free, deploys on every push |

**Alternatives considered:**
- *8th Wall:* Niantic retired the hosted platform. Check its current open-source status before considering it.
- *Zappar / Mattercraft:* a good commercial option if the team wants a paid, supported SDK.
- *Immersal Web SDK:* web VPS for later, when content must be placed freely in a space without image targets.

## 6. User flows

### Creator

1. Tap **Create** and enter a title and description.
2. At the place, tap **Add spot**. The browser captures the GPS position and the creator sets the unlock radius (or turns it off for indoors).
3. Take a photo of the target object. The app checks it has enough detail and compiles it into a `.mind` target in the browser.
4. Point the camera at the target. The live AR view starts.
5. Add content (model, text, image, audio). Move, rotate and scale it with on-screen controls. Positions are saved relative to the target.
6. Repeat for more spots if needed, then **Publish**. The app shows the public link, a QR code and the private edit link.

### Player

1. Open the link or scan the QR code, or tap **Explore** to see nearby experiences.
2. Choose an experience and see its spots with distance and directions (open in Maps).
3. Inside the radius, the spot unlocks: "Find this object" with a thumbnail of the target.
4. Point the camera at the target and the content appears. Tap items to interact.
5. Each visited spot is ticked off, stored locally in the browser for the POC.

## 7. Data model (POC)

```
Experience(id, title, description, cover_url, creator_device_id, edit_key_hash,
           status: draft|published, created_at)
Spot(id, experience_id, order, lat, lng, unlock_radius_m, geofence_enabled,
     target_image_url, target_mind_url, target_width_m)
ContentItem(id, spot_id, type: model|text|image|audio, asset_url, text,
            position{x,y,z}, rotation{x,y,z}, scale, props_json)
```

Positions are relative to the image target: the target's centre is the origin and its width is 1 unit.

## 8. POC milestones (about 4–5 weeks)

| Week | Deliverable |
|---|---|
| 1 | Project setup, Supabase schema and storage, deploy pipeline. MindAR shows a hard-coded model on a test image on iPhone and Android. |
| 2 | Creator flow: create an experience, add a spot with GPS, take the target photo and compile it in the browser, upload. |
| 3 | AR placement editor: add model, text, image and audio; move, rotate and scale; save and publish; QR code. |
| 4 | Player flow: explore list sorted by distance, geofence unlock, AR viewing, interactions, local progress. |
| 5 | Test at real sites (at least one indoor, one outdoor), fix bugs, polish, demo. |

## 9. Success criteria

1. A creator can build and publish a one-spot experience on site in **under 10 minutes**, from a phone, without help.
2. A player on a **different phone and OS** sees the content in the right place on the target.
3. Content appears within **3 seconds** of pointing the camera at the target in normal light.
4. It works on recent **iPhone (Safari)** and **Android (Chrome)** devices.
5. It's tested successfully at **at least 3 real places**, including indoors and outdoors.

## 10. After the POC (B2B roadmap)

| Phase | Scope |
|---|---|
| **1. MVP** | Authentication; **organisations** (each museum or client is a workspace with members and roles); creator web dashboard; multi-spot trails with ordering; moderation tools |
| **2. B2B features** | Branding (logo, colours, custom domain or white-label link); multiple languages per experience; analytics (visits, completions, time on site); quizzes, stamps and certificates |
| **3. Better anchoring** | Web VPS (e.g. Immersal) for free placement without image targets; GPS + compass outdoor mode for large-scale content |
| **4. Native apps (optional)** | If clients need more precise outdoor anchoring (Geospatial API), offline use or app-store presence: Unity + AR Foundation apps reading the same backend |

## 11. Risks

- **Image targets fail** with reflections, glass, low light or very plain objects. Mitigation: the editor shows a target quality score, and creators are encouraged to use a printed marker as a fallback.
- **Browser differences:** iOS and Android camera, compass and permission prompts behave differently. Test on real devices every week.
- **Phone performance:** large GLB models slow older phones. Limit upload size (for example 10 MB) and compress models (Draco/Meshopt).
- **Open, anonymous backend:** anyone can create content, including spam or inappropriate material. Acceptable for a closed POC. Share links only with testers, and add moderation and authentication in Phase 1.
- **Indoor GPS** is unreliable. That's why the geofence radius is adjustable and can be turned off for indoor spots.
