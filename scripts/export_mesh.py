"""
Writes the fsaverage5 brain mesh to frontend/public/brain-mesh.json, so the dashboard loads it as a static, cached
file from its own host instead of asking the API on every page load. The mesh is the same for every analysis; rerun
this only if the mesh changes. Coordinates are rounded to 0.01 mm, far below what the viewer can show.

    python scripts/export_mesh.py
"""
import json
from pathlib import Path

import numpy as np
from nilearn import datasets, surface

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "brain-mesh.json"

fsaverage = datasets.fetch_surf_fsaverage("fsaverage5")
left, faces_left = surface.load_surf_mesh(fsaverage["pial_left"])
right, faces_right = surface.load_surf_mesh(fsaverage["pial_right"])
mesh = {
    "vertices": np.round(np.concatenate([left, right]), 2).tolist(),
    "faces": np.concatenate([faces_left, faces_right + left.shape[0]]).astype(int).tolist(),
    "n_vertices_left": int(left.shape[0]),
    "n_vertices_right": int(right.shape[0]),
}
OUT.write_text(json.dumps(mesh, separators=(",", ":")))
print(f"Wrote {OUT.relative_to(OUT.parents[2])}: {OUT.stat().st_size / 1e6:.2f} MB")
