# PDF Merge Studio

A browser-based PDF merger, image editor, and PDF creator designed for static hosting on GitHub Pages.

## Features

- Upload multiple PDF and image files in the same batch
- Mix PDFs and images and drag them into the desired order
- Copy every page from each PDF without rasterizing it
- Preserve the dimensions and quality of original PDF pages
- Rotate images left or right
- Adjust brightness and contrast
- Convert images to grayscale
- Apply thresholded, high-contrast black-and-white processing for scanned text
- Export all source PDF pages and images into one PDF
- A4, US Letter, or image-fitted pages
- Automatic, portrait, or landscape orientation
- Compression presets, maximum image resolution, and adjustable JPEG quality
- Pre-conversion output-size estimate and final PDF size display
- Adjustable page margins
- Entirely client-side: files are not uploaded to a server

## Run locally

Because this is a static application, you can open `index.html` directly in a modern browser.

For a local HTTP server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. Open the repository's **Settings**.
4. Open **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and the `/ (root)` folder.
7. Save.

GitHub will show the public site address after deployment.

## Technical notes

- PDF creation uses [pdf-lib](https://pdf-lib.js.org/), loaded from a CDN.
- Existing PDF pages are copied directly into the output, preserving their page dimensions and vector/raster quality. Image page settings do not alter imported PDF pages.
- Image editing uses the browser's Canvas API.
- Password-protected PDFs must be unlocked before they can be merged.
- Very large images are downscaled internally when necessary to avoid browser memory limits.
- Animated GIF files are imported as a single still frame.
- HEIC/HEIF is not included because browser support is inconsistent.

## Repository structure

```text
.
├── index.html
├── style.css
├── app.js
└── README.md
```

## License

You may use, modify, and publish this project freely. Consider adding an MIT license to your repository.
