"""Fuse the shared MD stem and add neutral lighting and opposite-color outlines.

Created with assistance from OpenAI Codex. Run after create-logo.py.
Original letter meshes remain available as hidden construction geometry.
"""
import bpy
import bmesh
import json

scene = bpy.context.scene
if scene.name != 'Editor MD - Two Face Logo':
    raise RuntimeError('Select the Editor MD logo scene first.')
if scene.objects.get('MD - Shared Corner Solid'):
    raise RuntimeError('The shared corner solid already exists; edit it in place.')
m = scene.objects.get('M - Navy')
d = scene.objects.get('D - Orange')
if m is None or d is None or len(m.data.vertices) != 24 or len(d.data.vertices) != 32:
    raise RuntimeError('Expected the two original letter profiles.')
root = scene.objects.get('MD - Logo Assembly')
art = bpy.data.collections.get('MD - Letter Meshes')
thickness = .68

# Normalize both profiles and extrude along their face normals. Their shared
# stem is exactly the same .68 x .68 x 3.2 column, rather than adjacent bars.
m_origin_y = m.data.vertices[0].co.y
for i in range(12):
    front = m.data.vertices[i].co
    front.y -= m_origin_y
    m.data.vertices[i + 12].co = (front.x, front.y + thickness, front.z)
d_origin_y = d.data.vertices[0].co.y
for i in range(16):
    front = d.data.vertices[i].co
    front.y -= d_origin_y
    d.data.vertices[i + 16].co = (front.x - thickness, front.y, front.z)
for obj in (m, d):
    obj.data.update()
    for modifier in obj.modifiers:
        modifier.show_viewport = False
        modifier.show_render = False

combined = bpy.data.objects.new('MD - Shared Corner Solid', m.data.copy())
art.objects.link(combined)
combined.parent = root
for obj in scene.objects:
    obj.select_set(False)
combined.select_set(True)
bpy.context.view_layer.objects.active = combined
union = combined.modifiers.new('Fuse the common vertical stem', 'BOOLEAN')
union.operation = 'UNION'
union.solver = 'EXACT'
union.object = d
bpy.context.view_layer.update()
bpy.ops.object.modifier_apply(modifier=union.name)

bm = bmesh.new()
bm.from_mesh(combined.data)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
closed = all(edge.is_manifold for edge in bm.edges)
remaining = set(bm.verts)
components = 0
while remaining:
    components += 1
    pending = [remaining.pop()]
    while pending:
        vertex = pending.pop()
        for edge in vertex.link_edges:
            neighbor = edge.other_vert(vertex)
            if neighbor in remaining:
                remaining.remove(neighbor)
                pending.append(neighbor)
volume = bm.calc_volume()
bm.to_mesh(combined.data)
bm.free()
if not closed or components != 1:
    raise RuntimeError('Shared stem union did not produce one closed connected solid.')

navy = bpy.data.materials['MD Navy - #111e33']
navy_depth = bpy.data.materials['MD Navy - extrusion']
orange = bpy.data.materials['MD Orange - #f0a15a']
orange_depth = bpy.data.materials['MD Orange - extrusion']
combined.data.materials.clear()
for mat in (navy, navy_depth, orange, orange_depth):
    combined.data.materials.append(mat)
for face in combined.data.polygons:
    if face.normal.y < -.999 and abs(face.center.y) < .0001:
        face.material_index = 0
    elif face.normal.x > .999 and abs(face.center.x) < .0001:
        face.material_index = 2
    else:
        face.material_index = 1 if face.center.x < -thickness + .0001 else 3
    face.use_smooth = False
edge = combined.modifiers.new('Fine square edge chamfer', 'BEVEL')
edge.width = .014
edge.segments = 1
edge.affect = 'EDGES'
edge.harden_normals = True
combined['Construction'] = 'One connected solid; shared square corner stem, no shear.'
combined['Shared stem dimensions'] = [.68, .68, 3.2]

source = bpy.data.collections.new('MD - Construction Profiles (hidden)')
scene.collection.children.link(source)
for obj in (m, d):
    source.objects.link(obj)
    for collection in list(obj.users_collection):
        if collection != source:
            collection.objects.unlink(obj)
    obj.hide_render = True
    obj.hide_set(True)

outlines = bpy.data.collections.new('MD - Contrasting Letter Outlines')
scene.collection.children.link(outlines)

def outline(name, points, mat):
    curve = bpy.data.curves.new(name + ' - path', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = .032
    curve.bevel_resolution = 0
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for control, point in zip(spline.points, points):
        control.co = tuple(point) + (1,)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve)
    outlines.objects.link(obj)
    obj.parent = root
    curve.materials.append(mat)
    return obj

outline('M - Orange outline', [(v.co.x, -.025, v.co.z) for v in list(m.data.vertices)[:12]], orange)
outline('D - Navy outer outline', [(.025, v.co.y, v.co.z) for v in list(d.data.vertices)[:8]], navy)
outline('D - Navy inner outline', [(.025, v.co.y, v.co.z) for v in list(d.data.vertices)[8:16]], navy)

for mat in (navy, navy_depth, orange, orange_depth):
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .55
    shader.inputs['Specular IOR Level'].default_value = .18
for light in (obj for obj in scene.objects if obj.type == 'LIGHT'):
    light.data.color = (1, 1, 1)
    light.data.size = 5
    if 'key' in light.name:
        light.data.energy = 900
        light.name = 'MD - Neutral key softbox'
    elif 'fill' in light.name:
        light.data.energy = 700
        light.name = 'MD - Neutral side fill'
    else:
        light.data.energy = 800
        light.name = 'MD - Neutral top softbox'
world_shader = scene.world.node_tree.nodes.get('Background')
world_shader.inputs['Color'].default_value = (.22, .22, .22, 1)
world_shader.inputs['Strength'].default_value = .45
scene['Design'] = 'Unsheared MD monogram with one shared corner stem and opposite-color front and rear outlines.'
scene['Lighting'] = 'Neutral white studio softboxes and neutral gray environment.'
root['Note'] = 'One shared stem solid. Original letter profiles preserved in hidden construction collection.'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'RENDERED'
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
        area.spaces.active.overlay.show_overlays = False
print(json.dumps({'shared_stem': [.68, .68, 3.2], 'connected_solids': components,
                  'closed': closed, 'volume': round(volume, 4),
                  'outlines': len(outlines.objects), 'lighting': 'neutral white'}))
print('Run update-rear-outlines.py to trace the exposed rear face boundaries.')
