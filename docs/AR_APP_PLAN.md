# Plan: Location-Based AR App for Creators and Players

## 1. Core idea

A **creator** goes to a real place, places AR content there and publishes it as an experience. A **player** can only see and interact with that content when they physically stand at the same spot. Nothing is generated automatically and there is no global game map: every experience is made by a person, for a specific place.

## 2. The key technical decision: anchoring content to a place

GPS alone is accurate to roughly 5–15 m. That is fine for checking "you're nearby" but too loose to put a 3D object on a particular statue or door. So you need two layers:

| Layer | Purpose | Technology |
|---|---|---|
| **Coarse (unlock)** | Is the player within about 50 m? Show the experience on the map and unlock it. | GPS geofence |
| **Fine (placement)** | Put content in exactly the spot where the creator left it, accurate to centimetres. | A visual positioning system (VPS), which locates the phone from what the camera sees |

**Fine-placement options:**

- **ARCore Geospatial API (Google).** Works outdoors on iOS and Android, using Street View imagery. Accuracy is under a metre, and the creator doesn't need to scan anything. Best for cities and outdoor trails.
- **ARCore Cloud Anchors.** The creator scans the spot with their phone and the anchor is saved in the cloud. Works indoors, which matters for museums. Anchors can last up to 365 days.
- **Immersal or Niantic Spatial VPS.** The creator scans and maps a space. Strong indoors and suited to large venues, but these are paid services.

**Recommendation:** use GPS for the unlock, Geospatial API for outdoor placement and Cloud Anchors for indoor placement. Design the code so the anchor provider can be swapped later.

## 3. Tech stack

- **App:** Unity with AR Foundation, giving one codebase for iOS (ARKit) and Android (ARCore). Web AR is a poor fit because iOS Safari doesn't support WebXR or VPS.
- **Backend:** Supabase (Postgres with PostGIS for "experiences near me" queries), or Firebase with GeoFire.
- **Storage and CDN:** for 3D models (glTF/GLB), audio, images and video.
- **Creator web dashboard (optional):** for editing text, translations, analytics and publishing. Placement itself always happens on site in the app.

## 4. Main features

### Creator mode (in the app, on site)

1. Create an experience with a title, cover image, description and category.
2. Stand at the spot. The app localizes (VPS) and saves the anchor together with its GPS position.
3. Place content on the anchor: 3D models, text, audio, video, images, portals, and so on.
4. Adjust each item's position, rotation and scale with gestures.
5. Optionally chain several spots into a trail with an order, riddles or quiz questions.
6. Set rules: unlock radius, opening times, public, private or invite code.
7. Preview, then publish.

### Player mode

1. A map or list of nearby experiences, with distance and directions.
2. Content stays locked until the player is inside the geofence.
3. On arrival, a guided "scan the area" step localizes the phone, then the content appears.
4. Interactions: tap, collect, answer, trigger audio. Progress and badges are saved.
5. Optionally a check-in or proof of visit, such as a stamp or certificate.

### Making sure players are really there (anti-cheat)

- Successful VPS localization is strong proof in itself, because GPS spoofing can't fake the camera view.
- Detect mock locations and use Play Integrity on Android and App Attest on iOS.
- Validate on the server: check speed and distance between check-ins, and timestamps.

## 5. Data model (simplified)

```
User(id, role: creator|player, profile)
Experience(id, creator_id, title, description, status, visibility, created_at)
Spot(id, experience_id, order, lat, lng, altitude, unlock_radius_m,
     anchor_type: geospatial|cloud_anchor|vps, anchor_ref, heading)
ContentItem(id, spot_id, type: model|text|audio|video|image|quiz,
            asset_url, local_pose{position, rotation, scale}, props_json)
PlayerProgress(user_id, experience_id, spot_id, unlocked_at, completed_at)
```

## 6. Development phases

| Phase | Scope | Rough length |
|---|---|---|
| **0. Tech spike** | Test Geospatial API and Cloud Anchors at 2–3 real locations, indoor and outdoor. Measure accuracy and how long localization takes. | 2 weeks |
| **1. MVP** | Login, creator places one spot with basic content (3D model, text, image), publish, player map, geofence unlock, VPS display | 6–8 weeks |
| **2. Experiences** | Multi-spot trails, audio and video, quizzes, progress and badges, invite codes | 4–6 weeks |
| **3. Creator tools** | Web dashboard, asset library, translations, analytics (visits, completions) | 4–6 weeks |
| **4. Scale and polish** | Anti-cheat, offline caching, moderation and reporting, push notifications ("you're near an experience"), store launch | 4 weeks |

## 7. Risks to plan for

- **Localization fails** in poor light, in crowds, or after a place changes (renovation, seasons). Mitigation: let creators re-anchor, and show GPS-only content as a fallback.
- **Indoor coverage:** Geospatial API doesn't work indoors, so Cloud Anchors or a mapping-based VPS is required there.
- **Moderation:** user-made content in public places needs reporting tools and review. Creators should also not be allowed to anchor on private property or sensitive sites.
- **Battery and data:** AR plus GPS plus camera drains phones quickly. Keep sessions short and assets small.
- **VPS costs and quotas** grow as usage grows.

## 8. Open decisions

1. **Setting:** mainly outdoor (cities, trails), indoor (museums), or both? This decides the anchoring approach.
2. **Audience:** is this a consumer game, or a B2B tool for museums and tourism?
3. **Creators:** can anyone create, or only verified or paying creators?
4. **Target devices:** both iOS and Android from day one?
