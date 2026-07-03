# Magic Table Tracker HyperFrames

This folder contains a standalone HyperFrames composition for a polished Magic Table Tracker promo/demo video.

## What It Does

- Uses the app logo from `../../assets/lifecounter.png`.
- Presents the current core app features as timed scenes.
- Can be previewed as HTML or rendered to MP4 with HyperFrames.
- Does not call live app APIs during render, so output stays deterministic.

## Commands

Run these from `outputs/mtg-life-counter` after installing Node.js 22+ and FFmpeg:

```powershell
npm install
npm run hyperframes:lint
npm run hyperframes:validate
npm run hyperframes:preview
npm run hyperframes:render
```

The render command writes:

```text
outputs/mtg-life-counter/dist/magic-table-tracker-promo.mp4
```

## Manual Requirements

- Node.js 22 or newer.
- npm/npx available on PATH.
- FFmpeg available on PATH for MP4 rendering.
- Internet access for the GSAP CDN script during preview/render, unless you vendor GSAP locally.

