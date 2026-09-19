# DropImage setup

The app itself is ready to host as static files. There are no API keys, login systems, databases or social-platform approvals.

## The only monetisation setup: your ad account

DropImage already contains six ad placements:

- `top` — wide leaderboard above the app
- `left` — desktop left rail
- `right` — desktop right rail
- `inline1` — between upload and editor
- `inline2` — between organisation and export
- `footer` — wide billboard near the footer

After your Google AdSense site/account is approved, create responsive display ad units and add the public IDs to `config.js`:

```js
window.DROPIMAGE_CONFIG = {
  adsenseClient: "ca-pub-YOUR_PUBLISHER_ID",
  adSlots: {
    top: "YOUR_TOP_SLOT",
    left: "YOUR_LEFT_SLOT",
    right: "YOUR_RIGHT_SLOT",
    inline1: "YOUR_INLINE_SLOT_1",
    inline2: "YOUR_INLINE_SLOT_2",
    footer: "YOUR_FOOTER_SLOT"
  }
};
```

Those values are publisher/ad-unit identifiers, not private secrets.

DropImage will automatically replace the placeholder inventory with responsive AdSense units.

## Important ad placement note

Do not move advertisements into the upload drop zone, over download buttons, or into controls. Ad networks prohibit implementations designed to trigger accidental clicks or that mislead users into interacting with ads.

## Hosting

Any normal static host works. The repository contains no GitHub Actions workflow.

Because the app runs almost entirely client-side, its hosting requirements stay tiny even when image processing gets heavy: the visitor's own browser performs the conversion and ZIP work.

## ZIP support

ZIP generation uses JSZip from jsDelivr. If you want the app to be completely dependency-free later, vendor a reviewed copy of JSZip into the repository and update the script tag.

## Production checks before launch

- Replace the demo AdSense placeholders with your approved units.
- Set up any cookie/consent UI required for the countries you serve and the advertising products you enable.
- Keep `privacy.html` and `terms.html` accurate for your actual ad provider and hosting setup.
- Test large batches on desktop and mobile before advertising the site publicly.
