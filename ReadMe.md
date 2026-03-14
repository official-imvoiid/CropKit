<div align="center">

<img src="https://img.shields.io/badge/CropKit-Batch%20Image%20Studio-FF3333?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjYiIGhlaWdodD0iMjYiIHZpZXdCb3g9IjAgMCAyNiAyNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjYiIGhlaWdodD0iMjYiIHJ4PSI2IiBmaWxsPSIjRkYzMzMzIi8+PHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjEuNSIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjE0IiB5PSI0IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMS41IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMyIvPjxyZWN0IHg9IjQiIHk9IjE0IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMS41IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMyIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjEuNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==" alt="CropKit"/>

# CropKit · Batch Image Studio

**A fast, browser-based tool for cropping and exporting large batches of images — with individual settings per image, no uploads, no server.**

[![MIT License](https://img.shields.io/badge/license-MIT-FF3333?style=flat-square)](LICENSE)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite)
![JavaScript](https://img.shields.io/badge/JavaScript-97.9%25-f7df1e?style=flat-square&logo=javascript)

</div>

---

## Overview

CropKit is a client-side batch image editor built with React and Vite. It lets you load dozens (or hundreds) of images at once, set precise crop regions on each one individually, choose output format and quality per image, and export everything as a ZIP archive or as individual files — all without sending a single byte to a server.

Every operation happens in the browser using the Canvas API.

![CropKit Screenshot — Dark Mode](https://github.com/official-imvoiid/CropKit/blob/main/ui/Dark_Ui.png)

---

## Features

**Cropping**
- Free-form drag crop with 8-handle resize
- Aspect ratio presets — 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3 (click again to deselect and go free-form)
- Custom output size with locked ratio (e.g. 1024 × 1234) via "Lock ratio & reset crop"
- Crop box is hard-clamped to image bounds — can never exceed the image
- Crop position and size are remembered per image as you navigate

**Batch Workflow**
- Load images via file picker, folder picker, or drag-and-drop
- Per-image settings — crop, ratio, format, and quality are fully independent per image
- "Copy to all images" button in the header pushes the current image's settings and crop position to every other image at once
- Thumbnail strip with red dot indicator on images that have been cropped
- Navigate between images with arrow buttons or by clicking thumbnails

**Export**
- Output formats: JPG, PNG, WebP, AVIF
- Quality slider for JPG and WebP (60–100%)
- Download as a single ZIP archive or as individual files
- Rename pattern system — set a base name, numbering style (prefix / suffix), separator, padding digits, and optional range
- Folder structure is preserved inside the ZIP when loading from a folder

**Interface**
- Dark and light mode
- Mono/geometric design system — DM Mono + Syne typefaces
- Fully keyboard-navigable size inputs (Enter to commit)

![CropKit Screenshot — Settings Panel](https://github.com/official-imvoiid/CropKit/blob/main/ui/Selection_Option.png)

---

## Getting Started

**Requirements:** Node.js 18+

```bash
# Clone the repo
git clone https://github.com/official-imvoiid/CropKit.git
cd CropKit

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

**Build for production:**

```bash
npm run build
```

The output lands in `dist/` and can be served from any static host (Vercel, Netlify, GitHub Pages, etc.).

---

## Usage

1. **Load images** — drag files or a folder onto the canvas, or click the `+` area in the thumbnail strip to open the file / folder picker.
2. **Crop** — drag anywhere inside the crop box to move it, drag a handle to resize. The current dimensions are shown live on the canvas.
3. **Set a ratio** — click a preset pill (e.g. `16:9`) to lock the ratio. Click it again to return to free-form. Or type a custom size and click "Lock ratio & reset crop".
4. **Per-image settings** — each image keeps its own crop, format, and quality. The settings panel always reflects the currently active image.
5. **Copy to all** — once you have an image set up how you want, click "Copy to all images" in the header to apply those settings to every other image.
6. **Rename (optional)** — click "Set rename pattern" to configure batch renaming with numbered suffixes or prefixes.
7. **Export** — choose ZIP or Individual, then click Download.

---

## Project Structure

```
CropKit/
├── src/
│   └── App.jsx          # All application logic and UI
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── ui/                  # Screenshots and assets
├── index.html
├── vite.config.js
└── package.json
```

---

## Tech Stack

| | |
|---|---|
| Framework | React 18 (hooks, memo) |
| Bundler | Vite |
| Rendering | HTML5 Canvas API |
| Export | JSZip |
| Fonts | DM Mono, Syne (Google Fonts) |
| Styling | Inline styles with CSS custom properties |

No UI library dependencies. No backend. No data collection.

---

## License

MIT © [Shido / Voiid](https://github.com/official-imvoiid)
