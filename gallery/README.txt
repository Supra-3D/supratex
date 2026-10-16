SUPRA-Tex Studio
3D Generation with Super-Aligned Texture

STATIC WEBSITE HANDOFF

This directory is the complete gallery component for integration into the
project's main website. All code, eight full-geometry models, input images,
surface textures, fonts and Three.js dependencies are included locally.
No CDN, API key, external asset repository or backend service is required.
There is no build step or npm install. The main website is supplied separately.

MAIN WEBSITE INTEGRATION

1. Copy this directory's contents into a gallery/ directory in the main site's
   published static files. Preserve the internal directory structure.
2. Link from the main page to ./gallery/gallery.html, for example:
   <a href="./gallery/gallery.html">Explore the studio</a>
3. Deploy these files using the main website's normal static hosting, such as
   GitHub Pages. Visitors open the website URL and enter from the main page.
   They do not install Node.js, start a process, or choose a local port.

Example published layout:
  index.html                 (main website; not included)
  gallery/
    gallery.html             (gallery entry page)
    gallery.js, *.js, *.css
    gallery-data.json
    gallery-detail-data.json
    gallery-input-images.json
    assets/
    vendor/

The gallery supports hosting at the website root or under a project subpath;
asset references are relative to gallery.html. Keep the JSON manifests and
assets at their supplied relative paths. Serve JavaScript as JavaScript and
allow static JSON, GLB, image and WOFF2 downloads. If the host uses SPA routing,
exclude these files from HTML fallback rewrites. GLBs can be served as
model/gltf-binary or application/octet-stream. No custom application server,
cross-origin configuration or Node.js runtime is needed on the published site
when the included assets are served from the same origin.

LOCAL PREVIEW FOR DEVELOPERS ONLY

Use any local static web server. An optional dependency-free Node.js preview
server is included:
  node start-gallery.mjs
  http://localhost:8088/gallery.html
Windows: double-click the launch .cmd file after installing Node.js.
The server and .cmd launcher are optional preview tools, not production
dependencies. Opening gallery.html directly as a file:// URL is not the
published website workflow and is blocked by browser file-access restrictions.

CONTROLS AND FILES

Use WASD or click the floor/map to walk. Drag to look; scroll to zoom.
Select a viewpoint, then Inspect to orbit. Start returns to the entrance.
A browser supporting WebGL2 with hardware acceleration is required.

gallery.js: scene behavior, exhibit placement and interactions.
gallery-architecture.js: room geometry, lighting and physical fixtures.
gallery-data.json: exhibit identities, models and placement corrections.
gallery-detail-data.json: final model mappings and model metadata.
gallery-input-images.json: input-image framing and foreground metadata.
assets/models: the eight final, full-geometry display models.
assets/inputs: original input images and their foreground cutouts.
assets/materials: room surface textures and source credits.
assets/fonts and vendor/three: local dependencies and licenses.

Keep the included dependency licenses and texture source credits with delivery.
