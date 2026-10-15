# SUPRA-Tex project website

**SUPRA-Tex: 3D Generation with Super-Aligned Texture**

- Website: https://supra-3d.github.io/supratex/
- Research code: https://github.com/Supra-3D/supra-tex
- Large 3D assets: https://huggingface.co/datasets/supra3d/supratex-web-assets
- Generation demo: https://huggingface.co/spaces/UniLat3D/Supra-Tex

GitHub Pages serves this repository directly from the `main` branch root.
HTML, application scripts, images, videos, fonts, and small environment maps
remain here. The 73 large model payloads are fetched from Hugging Face.
`asset-hosting.js` pins their repository revision and maps their model IDs.
`asset-binaries.js` contains the matching binary model metadata.
This release uses gzip-compressed GLB binaries.
Binary delivery removes the Base64 wrapper without changing the model bytes.
The new comparison cases use texture maps capped at 4K; geometry and UVs are preserved.

For a local preview of this published checkout, use a static HTTP server and
append `?assetSource=remote` to the URL so the viewer fetches the hosted models.
The complete offline source package additionally contains the original model
scripts and uses those files by default on localhost.

The arXiv buttons temporarily link to the project website until its arXiv URL
is available. See the website for authors, citation, and dependency attribution.
