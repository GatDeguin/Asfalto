# Workshop surface textures

Nine photographic PBR maps, downloaded unmodified from Poly Haven's official asset API. All are 2048 x 2048 JPEG; the normal maps use the OpenGL tangent-space +Y convention. The official download checksums, authors, source URLs, and byte sizes are in `manifest.json`.

| Material | Files | One tile | Suggested material color | Normal strength | Roughness multiplier |
| --- | --- | --- | --- | --- | --- |
| `MAT_Floor_Concrete_Oily` | `floor-{baseColor,normal,roughness}-2k.jpg` | 3 x 3 m | `#969085` | 0.45 | 0.62 |
| `MAT_Wall_Plaster_Aged` | `plaster-{baseColor,normal,roughness}-2k.jpg` | 4 x 4 m | `#bcb4a1` | 0.55 | 1.0 |
| `MAT_Wall_Blue_OilPaint` | `blue-paint-{baseColor,normal,roughness}-2k.jpg` | 2 x 2 m | `#537481` | 0.35 | 0.85 |

These colors multiply the photographic albedo and are starting points for the workshop lighting. Use metalness 0 for all three surfaces. Avoid increasing normal strength enough to make the floor look rocky; the wear comes from recorded scratches and varied roughness. Use sRGB for base color only; normal and roughness maps are linear data. For Three.js roughness maps, set `material.roughness` to the multiplier. Use RepeatWrapping on both axes and planar UVs divided by the tile size in world meters. Use consistent UV orientation across adjoining wall objects. Set `flipY=false` when matching GLTFLoader UVs. Do not apply sRGB decoding to normal or roughness.

## Sources and license

- Floor: [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001), photography by Dimitrios Savva, processing by Rico Cilliers.
- Upper wall: [Plastered Wall 03](https://polyhaven.com/a/plastered_wall_03), Rob Tuytel.
- Lower wall: [Blue Plaster Wall](https://polyhaven.com/a/blue_plaster_wall), Dimitrios Savva.
- All maps are [CC0](https://polyhaven.com/license). Downloaded 2026-09-06. No upstream image pixels have been changed.

## Reproduction and verification

Run `tools/workshop_visuals/download_photographic_surfaces.ps1` to retrieve the official maps and check their published MD5 values. Run Blender 5.2 headless with `tools/workshop_visuals/validate_surface_assets.py` to decode and check the actual image dimensions, finite image data, useful variation, and normal convention. Reports live in `Reports/Asfalto_Nacional_v6_modular/workshop-surfaces`.

## Root cause

The source `Taller_Mecanico_Argentino_1973.blend` has no image textures for aged plaster, blue paint, black steel, or dark wood. Their color and normals are Blender-only Noise/ColorRamp/Bump node chains. The exported GLB therefore cannot preserve that appearance as standard glTF PBR without baking or replacement maps. The original floor maps contain broad sine-wave variation and four blurred oil shapes; they do not contain recorded concrete detail. These replacement photographic maps address that surface-detail gap. The source `.blend`, existing `Textures/` maps, and shipping GLB have not been modified by this asset work.

## Mapas de altura del taller

Los archivos `{floor,plaster,blue-paint,wood,steel}-height-1k.png` son mapas de desplazamiento oficiales de 1024², sin alterar, de los mismos materiales Poly Haven usados por sus mapas PBR. Se muestrean como datos lineales, con blanco como la parte más alta y la misma orientación UV que el albedo. Su procedencia, MD5 y dimensiones están en `height-provenance.json`.

Reproducción: `node tools/workshop_visuals/download_surface_height_maps.mjs`. Los archivos existentes con el MD5 correcto se reutilizan. La madera corresponde a [Dark Wood](https://polyhaven.com/a/dark_wood) y los metales a [Rusty Metal 02](https://polyhaven.com/a/rusty_metal_02), también CC0.
