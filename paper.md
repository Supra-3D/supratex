# SUPRA-Tex: 3D Generation with Super-Aligned Texture

Chen Yang, Jiemin Fang, Fanpeng Meng, Zihao Huang, Jichen Pang, Guanjun Wu, Zhikuan Bao, Qi Tian

Huawei Inc.; Shanghai Jiao Tong University; Huazhong University of Science and Technology.

Preprint: arXiv:2610.22352, submitted 15 October 2026.

[Interactive project](https://supra-3d.github.io/supratex/) | [Paper](https://arxiv.org/abs/2610.22352) | [HTML overview](https://supra-3d.github.io/supratex/paper.html)

## Abstract

Single image 3D generation aims to dress a given 3D mesh with relightable materials while faithfully preserving the visual details of a reference image. Existing methods either introduce artifacts when fusing inconsistent multi-view predictions or struggle to preserve fine details through implicit image-feature conditioning.

To resolve these challenges, we introduce SUPRA-Tex, built on the principle of decoupling visible-material estimation, surface alignment, and observation-guided 3D completion. This division of labor allows the 3D generator, trained on limited 3D data, to focus its capacity on preserving visible evidence and completing unobserved surfaces. Specifically, we first train an MLLM-based image editing model to predict lighting-separated PBR maps in the reference view. We then project these maps onto the visible surface and encode them with the pretrained material VAE encoder into native observation latents that share the generation target's latent space. An interleaved flow transformer holds these latents as fixed, read-only anchors while alternating unobserved-region and full-surface updates to generate complete material latents.

This design achieves super-alignment with the reference, delivering What You See Is What You Get fidelity on visible regions and coherent completion on unobserved surfaces. Trained solely on public datasets, SUPRA-Tex achieves SOTA performance in both geometry-conditioned texturing and end-to-end asset generation, matching or even exceeding leading commercial systems on in-the-wild images.

Abstract from the [arXiv preprint](https://arxiv.org/abs/2610.22352).

## Research overview

SUPRA-Tex studies reference-aligned 3D texture generation for image-to-3D assets and existing meshes. It estimates albedo, metallic and roughness from a reference image, aligns these observations to the mesh surface, and completes unseen regions with an Interleaved Flow Transformer.

## Image-to-3D and mesh texturing

The end-to-end workflow starts from a single image and produces a textured 3D asset. The texturing workflow takes an existing mesh, a camera and reference-view material observations. SUPRA-Tex focuses on material generation; the geometry frontend is a separate component. The output is a relightable GLB with base color, metallic and roughness textures.

## What does super-aligned texture mean?

Alignment refers to correspondence between the reference image and the texture on the 3D surface: lettering, patterns and material boundaries should remain in their observed locations. Surface-aligned observation latents provide fixed anchors while the model generates missing material. Here, alignment concerns image-to-surface fidelity.

## How does PBR texture generation work?

First, image-to-material translation estimates lighting-separated albedo, metallic and roughness maps. Next, native observation encoding projects the visible material onto the mesh and encodes it with a pretrained material VAE. Finally, the Interleaved Flow Transformer alternates updates to unseen regions and the full surface, conditioned on fixed observation tokens.

## Evidence and evaluation scope

The paper evaluates geometry-conditioned texturing and end-to-end generation on DTC-Tex and Complex-Tex. The project page includes full benchmark tables, human-preference results and commercial comparisons with their protocols. Input settings are disclosed per case: most commercial comparisons use a reference image plus a synthesized back view for SUPRA-Tex; the Fighter case uses one reference image. The compared services receive the reference image. Results depend on the task, metric and input setup.

## Relightable assets and Real2Sim

PBR materials let the generated asset be rendered under new lighting. The project demonstrates reference alignment, editable appearances and Real2Sim scenes that bring textured assets into simulated environments.

## Paper, implementation and results

- [Paper on arXiv](https://arxiv.org/abs/2610.22352)
- [Paper PDF](https://arxiv.org/pdf/2610.22352)
- [Code](https://github.com/Supra-3D/supra-tex)
- [Model weights](https://huggingface.co/supra3d/supra-tex)
- [Live demo](https://huggingface.co/spaces/UniLat3D/Supra-Tex)
- [Interactive results](https://supra-3d.github.io/supratex/#gallery)
- [Benchmarks and protocols](https://supra-3d.github.io/supratex/#evaluation)
- [Real2Sim examples](https://supra-3d.github.io/supratex/#embodied)

Code and model components have separate license terms; see the repository and model cards for the applicable terms.

## Citation

```bibtex
@article{yang2026supratex,
  title   = {{SUPRA-Tex}: 3D Generation with Super-Aligned Texture},
  author  = {Yang, Chen and Fang, Jiemin and Meng, Fanpeng and Huang, Zihao
             and Pang, Jichen and Wu, Guanjun and Bao, Zhikuan and Tian, Qi},
  journal = {arXiv preprint arXiv:2610.22352},
  year    = {2026},
  url     = {https://arxiv.org/abs/2610.22352}
}
```
