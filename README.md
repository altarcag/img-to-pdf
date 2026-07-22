# Image to PDF Studio

A browser-based image editor and PDF creator designed for static hosting on GitHub Pages.

## Features

- Upload multiple images
- Drag and drop to rearrange page order
- Rotate images left or right
- Adjust brightness and contrast
- Convert images to grayscale
- Apply thresholded, high-contrast black-and-white processing for scanned text
- Export all images into one PDF
- A4, US Letter, or image-fitted pages
- Automatic, portrait, or landscape orientation
- Adjustable page margins and JPEG quality
- Entirely client-side: images are not uploaded to a server

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
- Image editing uses the browser's Canvas API.
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
