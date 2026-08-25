"""
========================================================================
 BON TACOS  -  Maya reconstruction of the store scan (store_scan.glb)
========================================================================
Rebuilds the scanned restaurant interior in Autodesk Maya with correct
scale, orientation, textures, lighting and a camera set, ready for you to
lay out the dwarf / projection / signage concepts on top.

The GLB was analysed before this script was written. Facts it relies on:
  * Units : METERS, Y-up  (glTF native)
  * Meshes: 2  -> "GLTF"   (101,108 v / 167,794 f, 4096x4096 texture)
                  "GLTF_1" ( 33,570 v /  51,201 f, 4096x480  texture)
  * Node transforms are all identity (no baked rotation to undo)
  * Footprint ~ 8.1 m (X) x 6.3 m (Z),  ceiling height ~ 3.2 m (Y)

HOW TO RUN
----------
A) Inside Maya:  Windows > General Editors > Script Editor > Python tab,
   set SOURCE_DIR below, paste this file, run.
B) Headless:     mayapy reconstruct_bon_tacos.py  --source /path/to/assets

The folder pointed to by SOURCE_DIR must contain (produced alongside this
script): GLTF.obj, GLTF_1.obj, GLTF_diffuse.png, GLTF_1_diffuse.png
and optionally the original store_scan.glb for the native-import path.
========================================================================
"""

import os
import sys
import math
import maya.cmds as cmds
import maya.mel as mel

# ----------------------------------------------------------------------
# CONFIG  -- edit this one line to point at the exported assets folder
# ----------------------------------------------------------------------
SOURCE_DIR = r"E:/BON TACOS/bon_tacos_maya_kit"   # <-- assets folder

# If this file is run from disk (mayapy, or "Execute" on a saved file),
# default SOURCE_DIR to the folder the script lives in, so the assets are
# found automatically. When pasted into the Script Editor __file__ is not
# defined and the literal above is used instead.
try:
    SOURCE_DIR = os.path.dirname(os.path.abspath(__file__)) or SOURCE_DIR
except NameError:
    pass

GLB_FILE   = "store_scan.glb"                # used only by native import
PREFER_NATIVE_GLTF = True                    # try Maya's glTF importer first
GROUP_NAME = "BON_TACOS_scan"

# ---- floor-plan / reconstruction options ----
FLOOR_PLAN      = True     # build the top-down section (floor plan) camera
CUT_HEIGHT      = 1.4      # meters: horizontal cut height for the plan section
BUILD_ELEVATIONS = True    # add front + side orthographic elevation cameras
BUILD_GRID      = True     # measured 1 m floor grid for scale reference
DRAW_FOOTPRINT  = True     # red outline curve of the footprint on the floor
LOOK_THROUGH_PLAN = True   # end with the viewport looking through plan_cam

# Mesh -> texture map (from the pre-analysis of the GLB)
MESH_ASSETS = [
    {"obj": "GLTF.obj",   "tex": "GLTF_diffuse.png",   "name": "scan_main"},
    {"obj": "GLTF_1.obj", "tex": "GLTF_1_diffuse.png", "name": "scan_secondary"},
]


# ----------------------------------------------------------------------
# small helpers
# ----------------------------------------------------------------------
def _log(msg):
    print("[BON_TACOS] " + str(msg))


def _path(fname):
    return os.path.join(SOURCE_DIR, fname).replace("\\", "/")


def set_scene_units():
    """Match the glTF: meters, Y-up. Maya defaults to cm which makes the
    scan import 100x too big, so this is not optional."""
    cmds.currentUnit(linear="meter")
    try:
        mel.eval('setUpAxis "y";')   # glTF is Y-up; keep Maya Y-up too
    except Exception:
        pass
    _log("Scene units set to meters, Y-up.")


def ensure_plugins():
    """Load OBJ import and (if present) the glTF plugin."""
    for plug in ("objExport", "mayaUsdPlugin"):
        try:
            if not cmds.pluginInfo(plug, q=True, loaded=True):
                cmds.loadPlugin(plug, quiet=True)
        except Exception:
            pass
    # glTF plugin names differ across Maya versions / installs
    gltf_ok = False
    for plug in ("mayaGLTF", "glTF", "GLTFTranslator", "maya2glTF"):
        try:
            if cmds.pluginInfo(plug, q=True, registered=True):
                if not cmds.pluginInfo(plug, q=True, loaded=True):
                    cmds.loadPlugin(plug, quiet=True)
                gltf_ok = True
                break
        except Exception:
            continue
    return gltf_ok


# ----------------------------------------------------------------------
# material rebuild  (aiStandardSurface if Arnold present, else lambert)
# ----------------------------------------------------------------------
def build_textured_material(mat_name, tex_file):
    tex_path = _path(tex_file)
    if not os.path.exists(tex_path):
        _log("WARNING: texture missing -> " + tex_path)

    # file + place2dTexture
    file_node = cmds.shadingNode("file", asTexture=True, isColorManaged=True,
                                 name=mat_name + "_file")
    p2d = cmds.shadingNode("place2dTexture", asUtility=True,
                           name=mat_name + "_p2d")
    for attr in ("coverage", "translateFrame", "rotateFrame", "mirrorU",
                 "mirrorV", "stagger", "wrapU", "wrapV", "repeatUV",
                 "offset", "rotateUV", "noiseUV", "vertexUvOne",
                 "vertexUvTwo", "vertexUvThree", "vertexCameraOne"):
        try:
            cmds.connectAttr(p2d + "." + attr, file_node + "." + attr, f=True)
        except Exception:
            pass
    cmds.connectAttr(p2d + ".outUV", file_node + ".uvCoord", f=True)
    cmds.connectAttr(p2d + ".outUvFilterSize", file_node + ".uvFilterSize", f=True)
    cmds.setAttr(file_node + ".fileTextureName", tex_path, type="string")

    # shader: prefer Arnold's aiStandardSurface, else lambert
    use_arnold = False
    try:
        cmds.loadPlugin("mtoa", quiet=True)
        use_arnold = True
    except Exception:
        use_arnold = False

    if use_arnold:
        shd = cmds.shadingNode("aiStandardSurface", asShader=True,
                               name=mat_name + "_ai")
        cmds.connectAttr(file_node + ".outColor", shd + ".baseColor", f=True)
        cmds.setAttr(shd + ".specular", 0.05)      # scans are near-matte
        cmds.setAttr(shd + ".specularRoughness", 0.75)
    else:
        shd = cmds.shadingNode("lambert", asShader=True, name=mat_name + "_lam")
        cmds.connectAttr(file_node + ".outColor", shd + ".color", f=True)

    sg = cmds.sets(renderable=True, noSurfaceShader=True, empty=True,
                   name=mat_name + "_SG")
    cmds.connectAttr(shd + ".outColor", sg + ".surfaceShader", f=True)
    return sg


# ----------------------------------------------------------------------
# import paths
# ----------------------------------------------------------------------
def import_via_obj():
    """Robust path: import each OBJ, assign its extracted texture."""
    imported_roots = []
    for asset in MESH_ASSETS:
        obj_path = _path(asset["obj"])
        if not os.path.exists(obj_path):
            _log("MISSING OBJ, skipping: " + obj_path)
            continue

        before = set(cmds.ls(assemblies=True))
        cmds.file(obj_path, i=True, type="OBJ", ignoreVersion=True,
                  mergeNamespacesOnClash=False, rpr=asset["name"],
                  options="mo=1", pr=True, importTimeRange="combine")
        after = set(cmds.ls(assemblies=True))
        new_roots = list(after - before)

        sg = build_textured_material(asset["name"] + "_mat", asset["tex"])
        for root in new_roots:
            shapes = cmds.listRelatives(root, ad=True, type="mesh",
                                        fullPath=True) or []
            for shp in shapes:
                cmds.sets(shp, e=True, forceElement=sg)
            imported_roots.append(root)
        _log("Imported {} ({} shapes).".format(asset["name"], len(new_roots)))
    return imported_roots


def import_via_native(gltf_loaded):
    if not gltf_loaded:
        return None
    glb_path = _path(GLB_FILE)
    if not os.path.exists(glb_path):
        _log("No GLB for native import; using OBJ path.")
        return None
    before = set(cmds.ls(assemblies=True))
    try:
        cmds.file(glb_path, i=True, ignoreVersion=True, pr=True,
                  mergeNamespacesOnClash=False)
    except Exception as e:
        _log("Native glTF import failed ({}); using OBJ path.".format(e))
        return None
    after = set(cmds.ls(assemblies=True))
    roots = list(after - before)
    _log("Native glTF import produced {} root(s).".format(len(roots)))
    return roots or None


# ----------------------------------------------------------------------
# scan cleanup + framing
# ----------------------------------------------------------------------
def cleanup_and_group(roots):
    if not roots:
        _log("Nothing imported.")
        return None

    grp = cmds.group(roots, name=GROUP_NAME)
    # center the group's pivot and drop it to world origin for easy work
    cmds.xform(grp, centerPivots=True)
    bbox = cmds.exactWorldBoundingBox(grp)
    # sit the floor on Y=0
    cmds.move(0, -bbox[1], 0, grp, relative=True)
    cmds.makeIdentity(grp, apply=True, t=True, r=False, s=False, n=False)

    # scan hygiene: soften normals, remove any stray non-manifold noise,
    # and turn on double-sided so back-facing scan triangles still shade
    meshes = cmds.listRelatives(grp, ad=True, type="mesh", fullPath=True) or []
    for m in meshes:
        try:
            cmds.setAttr(m + ".doubleSided", 1)
        except Exception:
            pass
    transforms = cmds.listRelatives(grp, ad=True, type="transform",
                                    fullPath=True) or []
    for t in transforms:
        try:
            cmds.polySoftEdge(t, angle=45, ch=False)
        except Exception:
            pass
    _log("Grouped as '{}', floor placed on Y=0, normals softened.".format(grp))
    return grp


def add_lighting_and_camera(grp):
    # simple 3-point-ish setup so the textured scan reads well in viewport 2.0
    key = cmds.directionalLight(name="key_light", rotation=(-35, 30, 0),
                                intensity=1.1)
    cmds.directionalLight(name="fill_light", rotation=(-15, -110, 0),
                          intensity=0.4)
    try:
        amb = cmds.ambientLight(name="ambient_fill", intensity=0.25)
    except Exception:
        pass

    cam, camShape = cmds.camera(name="review_cam")
    cmds.setAttr(camShape + ".focalLength", 24)   # wide, for a narrow unit
    if grp:
        cmds.select(grp)
        cmds.viewFit(cam)
    _log("Added lights + wide review camera (24mm).")
    return cam


# ----------------------------------------------------------------------
# floor plan + elevations + scale helpers
# ----------------------------------------------------------------------
def _footprint(grp):
    """Bounding box + derived footprint dims for the grouped scan.
    Returns (bbox, width_x, depth_z, height_y, center_x, center_z)."""
    b = cmds.exactWorldBoundingBox(grp)   # [xmin,ymin,zmin,xmax,ymax,zmax]
    wx = b[3] - b[0]
    dz = b[5] - b[2]
    hy = b[4] - b[1]
    cx = (b[0] + b[3]) * 0.5
    cz = (b[2] + b[5]) * 0.5
    return b, wx, dz, hy, cx, cz


def build_measure_grid(grp):
    """A 1x1 m reference grid on the floor (Y=0), templated so it never
    renders and never gets in the way -- just a ruler under the plan."""
    b, wx, dz, hy, cx, cz = _footprint(grp)
    sx = int(math.ceil(wx)) + 2          # whole meters + 1 m margin each side
    sz = int(math.ceil(dz)) + 2
    grid = cmds.polyPlane(width=sx, height=sz, subdivisionsX=sx,
                          subdivisionsY=sz, axis=(0, 1, 0),
                          name="measure_grid_1m", ch=False)[0]
    cmds.move(cx, 0.0, cz, grid, absolute=True)
    gshape = (cmds.listRelatives(grid, shapes=True, fullPath=True) or [None])[0]
    if gshape:
        for a, v in (("primaryVisibility", 0), ("castsShadows", 0),
                     ("receiveShadows", 0)):
            try:
                cmds.setAttr(gshape + "." + a, v)
            except Exception:
                pass
    # template display = grey wireframe, unselectable, out of the way
    try:
        cmds.setAttr(grid + ".overrideEnabled", 1)
        cmds.setAttr(grid + ".overrideDisplayType", 1)
    except Exception:
        pass
    _log("Measured 1 m floor grid: {} x {} m.".format(sx, sz))
    return grid


def draw_footprint_outline(grp):
    """Red rectangle on the floor marking the scan footprint (measurable)."""
    b, wx, dz, hy, cx, cz = _footprint(grp)
    y = 0.003   # a hair above the floor to avoid z-fighting with the grid
    pts = [(b[0], y, b[2]), (b[3], y, b[2]), (b[3], y, b[5]),
           (b[0], y, b[5]), (b[0], y, b[2])]
    crv = cmds.curve(name="footprint_outline", degree=1, point=pts)
    shp = (cmds.listRelatives(crv, shapes=True) or [None])[0]
    if shp:
        try:
            cmds.setAttr(shp + ".overrideEnabled", 1)
            cmds.setAttr(shp + ".overrideColor", 13)   # red
        except Exception:
            pass
    _log("Footprint outline: {:.2f} m (X) x {:.2f} m (Z).".format(wx, dz))
    return crv


def add_plan_and_elevation_cameras(grp, cut_height=CUT_HEIGHT):
    """Top-down section 'floor plan' camera (clips away everything above the
    cut height so you read walls/fixtures, not the ceiling), plus optional
    front and side orthographic elevation cameras."""
    b, wx, dz, hy, cx, cz = _footprint(grp)
    margin = 1.12
    plan_cam = None

    if FLOOR_PLAN:
        H = hy + 6.0                      # camera height well above the ceiling
        plan_cam, plan_shape = cmds.camera(name="plan_cam")
        cmds.setAttr(plan_shape + ".orthographic", 1)
        cmds.setAttr(plan_shape + ".orthographicWidth", max(wx, dz) * margin)
        # section slab: show only floor (Y=0) up to the cut height
        cmds.setAttr(plan_shape + ".nearClipPlane", max(0.01, H - cut_height))
        cmds.setAttr(plan_shape + ".farClipPlane", H + 0.2)
        cmds.move(cx, H, cz, plan_cam, absolute=True)
        cmds.rotate(-90, 0, 0, plan_cam, absolute=True)   # look straight down
        _log("Floor-plan camera 'plan_cam' (section @ {:.2f} m).".format(
            cut_height))

    if BUILD_ELEVATIONS:
        dist = max(wx, dz, hy) * 2.0 + 5.0
        # front elevation: looks along -Z, from the +Z side
        f_cam, f_shape = cmds.camera(name="front_elev_cam")
        cmds.setAttr(f_shape + ".orthographic", 1)
        cmds.setAttr(f_shape + ".orthographicWidth", max(wx, hy) * margin)
        cmds.setAttr(f_shape + ".farClipPlane", dist * 3.0)
        cmds.move(cx, hy * 0.5, b[5] + dist, f_cam, absolute=True)
        cmds.rotate(0, 0, 0, f_cam, absolute=True)
        # side elevation: looks along -X, from the +X side
        s_cam, s_shape = cmds.camera(name="side_elev_cam")
        cmds.setAttr(s_shape + ".orthographic", 1)
        cmds.setAttr(s_shape + ".orthographicWidth", max(dz, hy) * margin)
        cmds.setAttr(s_shape + ".farClipPlane", dist * 3.0)
        cmds.move(b[3] + dist, hy * 0.5, cz, s_cam, absolute=True)
        cmds.rotate(0, 90, 0, s_cam, absolute=True)
        _log("Elevation cameras: front_elev_cam, side_elev_cam.")

    return plan_cam


def make_display_layer(grp):
    """Put the scan on its own display layer so the ceiling can be toggled
    off for a cleaner plan view."""
    try:
        lyr = cmds.createDisplayLayer(name="scan_LYR", empty=True)
        cmds.editDisplayLayerMembers(lyr, grp)
        _log("Scan placed on display layer 'scan_LYR' (toggle visibility).")
        return lyr
    except Exception:
        return None


# ----------------------------------------------------------------------
# main
# ----------------------------------------------------------------------
def main():
    _log("=== BON TACOS reconstruction start ===")
    if not os.path.isdir(SOURCE_DIR):
        cmds.error("SOURCE_DIR does not exist: " + SOURCE_DIR)
        return

    set_scene_units()
    gltf_loaded = ensure_plugins()

    roots = None
    if PREFER_NATIVE_GLTF:
        roots = import_via_native(gltf_loaded)
    if not roots:
        roots = import_via_obj()

    grp = cleanup_and_group(roots)
    add_lighting_and_camera(grp)

    # floor plan + elevations + scale references + display layer
    plan_cam = None
    if grp:
        if BUILD_GRID:
            build_measure_grid(grp)
        if DRAW_FOOTPRINT:
            draw_footprint_outline(grp)
        if FLOOR_PLAN or BUILD_ELEVATIONS:
            plan_cam = add_plan_and_elevation_cameras(grp, CUT_HEIGHT)
        make_display_layer(grp)

    # frame everything, switch viewport to textured mode
    try:
        panel = cmds.getPanel(withFocus=True)
        cmds.modelEditor(panel, e=True, displayAppearance="smoothShaded",
                         displayTextures=True)
        # drop into the floor-plan view if we built one
        if LOOK_THROUGH_PLAN and plan_cam:
            cmds.lookThru(panel, plan_cam)
    except Exception:
        pass

    _log("=== Done. Scan under '{}'. Cameras: plan_cam, front_elev_cam, "
         "side_elev_cam, review_cam. ===".format(GROUP_NAME))


# allow  `mayapy reconstruct_bon_tacos.py --source /path`
if __name__ == "__main__":
    if "--source" in sys.argv:
        SOURCE_DIR = sys.argv[sys.argv.index("--source") + 1]
    try:
        import maya.standalone as _std
        _std.initialize(name="python")
    except Exception:
        pass
    main()
