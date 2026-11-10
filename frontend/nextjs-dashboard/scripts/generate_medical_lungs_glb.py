from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


@dataclass
class LobeSpec:
    name: str
    side: str
    y_rule: str


def make_uv(vertices: np.ndarray) -> np.ndarray:
    x = vertices[:, 0]
    y = vertices[:, 1]
    z = vertices[:, 2]

    theta = np.arctan2(z, x)
    r = np.linalg.norm(vertices, axis=1)
    phi = np.arccos(np.clip(y / np.maximum(r, 1e-8), -1.0, 1.0))

    u = (theta + np.pi) / (2.0 * np.pi)
    v = phi / np.pi
    return np.column_stack([u, v])


def _sigmoid(x: np.ndarray, k: float = 10.0) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-k * x))


def build_continuous_lung_surface(side: str, rings: int = 68, slices: int = 84) -> tuple[np.ndarray, np.ndarray]:
    side_sign = -1.0 if side == "left" else 1.0
    center_x = side_sign * 0.5

    # Use interior latitude rings and explicit poles to keep a watertight organic volume
    # without tube-like stems or cone-like tips.
    t_vals = np.linspace(0.04, 0.96, rings)  # 0=apex, 1=base
    theta_vals = np.linspace(0.0, 2.0 * np.pi, slices, endpoint=False)

    vertices: list[list[float]] = []

    for t in t_vals:
        # A) Front profile: broad mid-lung, gentle superior taper, compressed base.
        mid = np.exp(-((t - 0.48) / 0.28) ** 2)
        superior = np.exp(-((t - 0.08) / 0.12) ** 2)
        inferior = np.exp(-((t - 0.9) / 0.14) ** 2)
        front_width = 0.22 + 0.28 * mid + 0.08 * superior + 0.1 * inferior

        # B) Side profile: fuller anterior chest wall and flatter posterior contour.
        side_depth = 0.18 + 0.24 * mid + 0.06 * superior + 0.08 * inferior

        # Top and base transitions are broad/rounded, not sharp.
        superior_taper = 1.0 - 0.22 * _sigmoid(np.array([(0.14 - t)]), 18.0)[0]
        base_compress = 1.0 - 0.24 * _sigmoid(np.array([(t - 0.82)]), 16.0)[0]
        front_width *= superior_taper
        side_depth *= base_compress

        # Vertical profile with a flattened diaphragmatic floor.
        y = 0.94 - 1.82 * t
        if y < -0.57:
            y = -0.57 + (y + 0.57) * 0.33

        for theta in theta_vals:
            c = np.cos(theta)
            s = np.sin(theta)

            # C) Top profile: bean-like cross section with medial flattening.
            lateral_dir = side_sign * c
            medial_gate = np.clip(-lateral_dir, 0.0, 1.0)
            lateral_gate = np.clip(lateral_dir, 0.0, 1.0)

            medial_flat = 1.0 - 0.38 * medial_gate
            lateral_full = 1.0 + 0.08 * lateral_gate

            front_gate = np.clip(s, 0.0, 1.0)
            back_gate = np.clip(-s, 0.0, 1.0)
            anterior_curve = 1.0 + 0.2 * front_gate
            posterior_flat = 1.0 - 0.2 * back_gate

            bean = 1.0 + 0.06 * np.sin(theta - side_sign * 0.38) - 0.04 * np.sin(2.0 * theta)

            # Multi-axis blending of independent profiles.
            rx = front_width * medial_flat * lateral_full
            rz = side_depth * anterior_curve * posterior_flat * bean

            # Superellipse mapping gives organic curvature and avoids cylindrical reads.
            x_local = rx * np.sign(c) * (np.abs(c) ** 0.72)
            z = rz * np.sign(s) * (np.abs(s) ** 0.82)

            # Slight forward lean from apex to base.
            z += 0.08 * (0.5 - t)

            # Cardiac notch on left medial-anterior superior region.
            if side == "left" and medial_gate > 0.3 and front_gate > 0.05:
                notch = 0.18 * np.exp(-((t - 0.33) / 0.16) ** 2) * medial_gate * (0.45 + front_gate)
                x_local -= notch
                z *= 0.96

            # Right lung is fuller and wider.
            if side == "right":
                x_local *= 1.08
                z *= 1.04
            else:
                z *= 0.95

            # Small organic break-up without visible roughness.
            micro = np.sin((x_local + y) * 16.0) * np.cos((z - y) * 11.0) * 0.0014
            x = center_x + x_local + micro
            z = z + micro * 0.6

            vertices.append([x, y, z])

    vertices_np = np.asarray(vertices, dtype=np.float64)

    faces: list[list[int]] = []
    for r in range(rings - 1):
        base0 = r * slices
        base1 = (r + 1) * slices
        for s in range(slices):
            s_next = (s + 1) % slices
            a = base0 + s
            b = base0 + s_next
            c = base1 + s
            d = base1 + s_next
            faces.append([a, c, b])
            faces.append([b, c, d])

    # Poles are placed close to terminal rings to keep ends broad and rounded.
    top_center = len(vertices_np)
    bottom_center = top_center + 1
    top = np.array([[center_x, 0.99, 0.015]], dtype=np.float64)
    bottom = np.array([[center_x, -0.70, -0.005]], dtype=np.float64)
    vertices_np = np.vstack([vertices_np, top, bottom])

    for s in range(slices):
        s_next = (s + 1) % slices
        faces.append([top_center, s_next, s])

        b0 = (rings - 1) * slices + s
        b1 = (rings - 1) * slices + s_next
        faces.append([bottom_center, b0, b1])

    faces_np = np.asarray(faces, dtype=np.int64)
    return vertices_np, faces_np


def split_lobe_faces(vertices: np.ndarray, faces: np.ndarray, side: str) -> dict[str, np.ndarray]:
    centers = vertices[faces].mean(axis=1)
    cy = centers[:, 1]
    cz = centers[:, 2]

    out: dict[str, np.ndarray] = {}

    if side == "left":
        # Oblique fissure style boundary (continuous surface, no hard gap).
        boundary = 0.14 - 0.27 * np.clip(cz, -0.35, 0.35)
        upper = cy >= boundary
        out["left_upper_lobe"] = faces[upper]
        out["left_lower_lobe"] = faces[~upper]
    else:
        upper = cy >= 0.22
        middle = (cy < 0.22) & (cy >= (-0.08 - 0.16 * np.clip(cz, -0.35, 0.35)))
        lower = ~(upper | middle)
        out["right_upper_lobe"] = faces[upper]
        out["right_middle_lobe"] = faces[middle]
        out["right_lower_lobe"] = faces[lower]

    return out


def build_lobe_mesh(vertices: np.ndarray, faces: np.ndarray, material: PBRMaterial) -> trimesh.Trimesh:
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True, validate=True)
    mesh.process(validate=True)
    mesh.remove_unreferenced_vertices()

    uv = make_uv(mesh.vertices)
    mesh.visual = TextureVisuals(uv=uv, material=material)
    return mesh


def normalize_scene(scene: trimesh.Scene, target_span: float = 2.0) -> None:
    bounds = scene.bounds
    center = bounds.mean(axis=0)
    size = bounds[1] - bounds[0]
    max_dim = float(np.max(size))
    scale = target_span / max(max_dim, 1e-8)

    mat = np.eye(4)
    mat[:3, 3] = -center
    scene.apply_transform(mat)

    smat = np.eye(4)
    smat[:3, :3] *= scale
    scene.apply_transform(smat)


def triangle_count(scene: trimesh.Scene) -> int:
    total = 0
    for geom in scene.geometry.values():
        total += int(len(geom.faces))
    return total


def build_scene() -> trimesh.Scene:
    mat_left = PBRMaterial(
        name="lung_left_material",
        baseColorFactor=[216, 141, 145, 255],
        metallicFactor=0.0,
        roughnessFactor=0.9,
    )
    mat_right = PBRMaterial(
        name="lung_right_material",
        baseColorFactor=[224, 149, 153, 255],
        metallicFactor=0.0,
        roughnessFactor=0.88,
    )

    lobe_specs = [
        LobeSpec("left_upper_lobe", "left", "upper"),
        LobeSpec("left_lower_lobe", "left", "lower"),
        LobeSpec("right_upper_lobe", "right", "upper"),
        LobeSpec("right_middle_lobe", "right", "middle"),
        LobeSpec("right_lower_lobe", "right", "lower"),
    ]

    scene = trimesh.Scene(base_frame="lungs_root")

    # Add hierarchy grouping nodes.
    scene.graph.update(frame_to="left_lung", frame_from="lungs_root", matrix=np.eye(4))
    scene.graph.update(frame_to="right_lung", frame_from="lungs_root", matrix=np.eye(4))

    left_v, left_f = build_continuous_lung_surface("left", rings=66, slices=72)
    right_v, right_f = build_continuous_lung_surface("right", rings=66, slices=72)

    left_split = split_lobe_faces(left_v, left_f, "left")
    right_split = split_lobe_faces(right_v, right_f, "right")

    for spec in lobe_specs:
        parent = "left_lung" if spec.side == "left" else "right_lung"
        mat = mat_left if spec.side == "left" else mat_right

        if spec.side == "left":
            faces = left_split[spec.name]
            mesh = build_lobe_mesh(left_v, faces, mat)
        else:
            faces = right_split[spec.name]
            mesh = build_lobe_mesh(right_v, faces, mat)

        mesh.metadata["semantic_name"] = spec.name
        scene.add_geometry(
            mesh,
            geom_name=spec.name,
            node_name=spec.name,
            parent_node_name=parent,
            transform=np.eye(4),
        )

    normalize_scene(scene, target_span=2.0)
    return scene


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "public" / "models"
    out_dir.mkdir(parents=True, exist_ok=True)

    output_file = out_dir / "medical_lungs.glb"

    scene = build_scene()
    tri_count = triangle_count(scene)

    if not (8000 <= tri_count <= 25000):
        raise RuntimeError(f"Triangle budget out of range: {tri_count}")

    glb_bytes = scene.export(file_type="glb")
    output_file.write_bytes(glb_bytes)

    print(f"Wrote: {output_file}")
    print(f"Triangles: {tri_count}")
    print("Hierarchy: lungs_root -> left_lung/right_lung -> lobe meshes")


if __name__ == "__main__":
    main()
