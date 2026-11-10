# Medical Lung Model Asset

Place a production medical lung model at:

- `public/models/medical_lungs.glb`

Expected recommendations:

- Separate meshes for left and right lungs (mesh names containing `left` and `right` help automatic mapping).
- Pivot centered near thorax origin.
- Reasonable scale (meters or normalized around unit size).
- Optional airway and vessel meshes are supported.

This visualization automatically falls back to procedural lungs if the GLB is missing.
