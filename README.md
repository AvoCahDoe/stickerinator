# Stickerinator

Die-cut sticker studio in the browser: margins, flood-fill cutout, stacked outline layers, SVG/PDF ingest, and on-device AI background removal ([`@imgly/background-removal`](https://www.npmjs.com/package/@imgly/background-removal)).

## Features

- **Full process** — pad margin, detect/pick background, flood-fill cutout, white border + external rings, crop
- **Layers only** — outline from alpha (or AI-cleaned mask) without flood-fill
- **Formats** — PNG, JPG, WebP, GIF, BMP, SVG, PDF (first page)
- **Presets** — save/load layer stacks in `localStorage`
- **Downloads** — keep the source stem (`logo.svg` → `logo.png`)

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

**Live:** [stickerinator.vercel.app](https://stickerinator.vercel.app)

1. Push this repo to GitHub ([AvoCahDoe/stickerinator](https://github.com/AvoCahDoe/stickerinator))
2. [Import the project on Vercel](https://vercel.com/new) (or `npx vercel`)
3. Framework: **Next.js** (root = repository root)
4. Deploy — no env vars required for IMG.LY (models load in the browser)

```bash
npx vercel --prod
```

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Client-side sticker engine (canvas / ImageData)
- `pdfjs-dist` for PDF page 1
- `@imgly/background-removal` for smart cutouts
