# Icon Files Required for PWA

## Known Limitation

Icon files are currently not required in the VitePWA configuration to allow development without them. The PWA will function but may not be installable until icons are added.

## Required Icons

To enable full PWA installability, place the following icon files in this directory:

- `icon-192.png` - 192x192 PNG icon for PWA
- `icon-512.png` - 512x512 PNG icon for PWA

After adding icons, update `vite.config.js` to include them in the `icons` array.
