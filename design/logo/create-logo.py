"""Editor, MD logo, created with OpenAI Codex assistance in Blender.

Run through blenderwright's execute_code command, with raw Python enabled
by the user. Creates a new scene and leaves the original scene intact.
"""
import bpy
import bmesh
from mathutils import Vector

SCENE_NAME = 'Editor MD - Two Face Logo'
LETTER_DEPTH = 0.68
if bpy.data.scenes.get(SCENE_NAME):
    raise RuntimeError('Logo scene already exists; edit that scene instead of duplicating it.')

scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
scene['Design'] = 'Two adjacent letter faces sharing a square corner stem, with straight perpendicular extrusion.'
scene['Attribution'] = 'Created with assistance from OpenAI Codex.'
scene['Palette'] = 'Dark theme: navy #111e33, orange #f0a15a'

art = bpy.data.collections.new('MD - Letter Meshes')
rig = bpy.data.collections.new('MD - Camera and Studio Lights')
scene.collection.children.link(art)
scene.collection.children.link(rig)

def linear_color(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb) + (1,)

def material(name, color, roughness=0.38):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = linear_color(color)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = linear_color(color)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Specular IOR Level'].default_value = 0.28
    return mat

navy = material('MD Navy - #111e33', '#111e33')
navy_depth = material('MD Navy - extrusion', '#172b47')
orange = material('MD Orange - #f0a15a', '#f0a15a')
orange_depth = material('MD Orange - extrusion', '#ca7737')

root = bpy.data.objects.new('MD - Logo Assembly', None)
art.objects.link(root)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.4
root['Note'] = 'Only two letter faces. Each letter is independently editable.'

def point(u, z, depth, letter):
    # Both 0.68-wide stems occupy one square corner column. The finishing
    # step unions them into one solid. Neither letter has a sheared profile.
    return (u - 3, depth, z) if letter == 'M' else (-depth, u, z)

def mesh_object(name, vertices, faces, front_faces, front_mat, side_mat):
    mesh = bpy.data.meshes.new(name + ' - mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    art.objects.link(obj)
    obj.parent = root
    mesh.materials.append(front_mat)
    mesh.materials.append(side_mat)
    for face in mesh.polygons:
        face.material_index = 0 if face.index in front_faces else 1
        face.use_smooth = False
    bevel = obj.modifiers.new('Tiny flat edge chamfer', 'BEVEL')
    bevel.width = 0.018
    bevel.segments = 1
    bevel.affect = 'EDGES'
    bevel.harden_normals = True
    bevel.material = 0
    obj['Style'] = 'Bold, faceted console-era letterform; no font dependency.'
    return obj

depth = LETTER_DEPTH
m_outline = [(0, 0), (.68, 0), (.68, 1.9), (1.5, .85),
             (2.32, 1.9), (2.32, 0), (3, 0), (3, 3.2),
             (2.35, 3.2), (1.5, 2.0), (.65, 3.2), (0, 3.2)]
n = len(m_outline)
m_verts = [point(u, z, d, 'M') for d in (0, depth) for u, z in m_outline]
m_faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
m_faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
m = mesh_object('M - Navy', m_verts, m_faces, {0}, navy, navy_depth)

outer = [(0, 0), (1.75, 0), (2.55, .4), (3, 1.05),
         (3, 2.15), (2.55, 2.8), (1.75, 3.2), (0, 3.2)]
inner = [(.68, .65), (1.60, .65), (2.05, .90), (2.28, 1.25),
         (2.28, 1.95), (2.05, 2.3), (1.60, 2.55), (.68, 2.55)]
d_verts = [point(u, z, d, 'D') for d in (0, depth) for loop in (outer, inner) for u, z in loop]
d_faces = []
d_front = set()
for i in range(8):
    j = (i + 1) % 8
    d_front.add(len(d_faces))
    d_faces.extend([(i, j, 8 + j, 8 + i),
                    (16 + i, 24 + i, 24 + j, 16 + j),
                    (i, 16 + i, 16 + j, j),
                    (8 + i, 8 + j, 24 + j, 24 + i)])
d = mesh_object('D - Orange', d_verts, d_faces, d_front, orange, orange_depth)

target = Vector((-0.82, .82, 1.62))
camera_data = bpy.data.cameras.new('MD - Orthographic Camera')
camera = bpy.data.objects.new('MD - Camera', camera_data)
rig.objects.link(camera)
camera.location = target + Vector((10, -10, 7.0))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 6.25
camera_data.lens = 50
camera_data.clip_end = 200
scene.camera = camera

def area_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    rig.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj

area_light('MD - Softbox key', (-4, -6, 9), 900, 5, (1, 1, 1))
area_light('MD - Side fill', (7, -2, 5), 700, 5, (1, 1, 1))
area_light('MD - Top softbox', (-3, 5, 8), 800, 5, (1, 1, 1))

world = bpy.data.worlds.new('MD - Neutral Studio')
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.22, .22, .22, 1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .45
scene.world = world
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1536
scene.render.resolution_y = 1536
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.filepath = '//editor-md-logo.png'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.fps = 24

# Leave Blender showing the actual camera composition, with uncluttered
# material-colored solid shading. Render settings and lights remain editable.
for screen in bpy.data.screens:
    if screen == bpy.context.window.screen:
        for area in screen.areas:
            if area.type == 'CONSOLE':
                area.type = 'VIEW_3D'
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.region_3d.view_camera_zoom = 12
                space.overlay.show_overlays = False
                space.shading.type = 'MATERIAL'
                space.show_region_ui = False
                space.show_region_toolbar = False

bpy.context.view_layer.objects.active = m
print('Created:', scene.name)
print('Letter meshes:', m.name, 'and', d.name)
print('Camera: two adjacent faces; transparent 1536 x 1536 PNG ready.')
print('Run finish-logo.py to fuse the shared stem and add contrasting outlines.')
