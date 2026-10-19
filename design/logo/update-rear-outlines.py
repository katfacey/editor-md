"""Add matching rear outlines to the existing logo without changing its solid.

Created with assistance from OpenAI Codex.
"""
import bpy
import json
from mathutils import Vector

scene = bpy.context.scene
if scene.name != 'Editor MD - Two Face Logo':
    raise RuntimeError('Select the Editor MD logo scene first.')
collection = bpy.data.collections['MD - Contrasting Letter Outlines']
solid = scene.objects['MD - Shared Corner Solid']
solid.data.update()
root = scene.objects['MD - Logo Assembly']

# Trace exposed face boundaries after the stem union; a complete duplicate
# of each source profile would place trim inside the other letter's face.
def rear_outline(name, axis, plane, normal, material_index, color):
    edges = {}
    for face in solid.data.polygons:
        if face.normal[axis] * normal < .999 or abs(face.center[axis] - plane) > .0001:
            continue
        face.material_index = material_index
        for edge in face.edge_keys:
            key = tuple(sorted(edge))
            edges[key] = edges.get(key, 0) + 1
    pending = {key for key, count in edges.items() if count == 1}
    adjacency = {}
    for a, b in pending:
        adjacency.setdefault(a, []).append(b)
        adjacency.setdefault(b, []).append(a)
    if any(len(neighbors) != 2 for neighbors in adjacency.values()):
        raise RuntimeError('Rear outline has an unexpected boundary junction.')
    paths = []
    while pending:
        start, current = next(iter(pending))
        pending.remove(tuple(sorted((start, current))))
        path = [start, current]
        while current != start:
            choices = [n for n in adjacency[current] if tuple(sorted((current, n))) in pending]
            if not choices:
                raise RuntimeError('Rear outline boundary did not close.')
            following = choices[0]
            pending.remove(tuple(sorted((current, following))))
            current = following
            path.append(current)
        paths.append(path[:-1])
    curve = bpy.data.curves.new(name + ' - path', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = .032
    curve.bevel_resolution = 0
    curve.use_fill_caps = True
    offset = Vector((0, 0, 0))
    offset[axis] = normal * .025
    for path in paths:
        spline = curve.splines.new('POLY')
        spline.points.add(len(path) - 1)
        for point, index in zip(spline.points, path):
            point.co = tuple(solid.data.vertices[index].co + offset) + (1,)
        spline.use_cyclic_u = True
    curve.materials.append(color)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.parent = root
    obj['Outline side'] = 'Rear'
    return {'name': name, 'closed_paths': len(paths)}

for obj in list(collection.objects):
    if 'rear' in obj.name.lower():
        bpy.data.objects.remove(obj, do_unlink=True)
checks = [rear_outline('M - Orange rear outline', 1, .68, 1, 0,
                       bpy.data.materials['MD Orange - #f0a15a']),
          rear_outline('D - Navy rear outline', 0, -.68, -1, 2,
                       bpy.data.materials['MD Navy - #111e33'])]
scene['Design'] = 'Unsheared MD monogram with one shared corner stem and opposite-color front and rear outlines.'
print(json.dumps({'rear_outlines': checks, 'outline_objects': len(collection.objects)}))
