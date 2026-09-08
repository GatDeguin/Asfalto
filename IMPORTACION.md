# Importación del juego completo

El proceso propuesto usa GitHub Actions con permiso de escritura en este repositorio para importar el commit verificado a la rama nueva `imported-asfalto-v6-20260908`. Comprueba el tamaño, SHA-256 de cada bloque y del paquete completo, el commit esperado y los 477 archivos antes de subir esa rama.

Este documento permite revisar el proceso. El código solo se ejecuta al instalarlo como un workflow de GitHub Actions.

```yaml
name: Importar juego completo

on:
  push:
    branches: [upload-asfalto-v6-20260908]

permissions:
  contents: write

concurrency:
  group: importar-asfalto-v6
  cancel-in-progress: false

jobs:
  importar:
    if: startsWith(github.event.head_commit.message, 'Transferencia completa')
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - name: Reconstruir y verificar el juego
        env:
          EXPECTED_COMMIT: 02843a9ab632ec7183143f6b3b3272e6aa243116
          EXPECTED_BUNDLE: b895c2829d3ab48575321f54dec31b4660bfeb0822dea7381d2928970cfc0aad
        run: |
          python3 - <<'PY'
          import hashlib, json, os, pathlib
          manifest = json.loads(pathlib.Path('.github/game-import/manifest.json').read_text())
          assert manifest['commit'] == os.environ['EXPECTED_COMMIT']
          assert manifest['sha256'] == os.environ['EXPECTED_BUNDLE']
          assert len(manifest['parts']) == 75
          digest = hashlib.sha256()
          size = 0
          target = pathlib.Path(os.environ['RUNNER_TEMP']) / 'asfalto-game.bundle'
          with target.open('wb') as output:
              for i, part in enumerate(manifest['parts']):
                  assert part['index'] == i
                  assert part['path'] == f'.github/game-import/part-{i:03d}.bin'
                  data = pathlib.Path(part['path']).read_bytes()
                  assert len(data) == part['bytes']
                  assert hashlib.sha256(data).hexdigest() == part['sha256']
                  digest.update(data)
                  size += len(data)
                  output.write(data)
          assert size == manifest['bytes']
          assert digest.hexdigest() == os.environ['EXPECTED_BUNDLE']
          print(f'Integridad verificada: {size} bytes')
          PY
          git bundle verify "$RUNNER_TEMP/asfalto-game.bundle"
          git fetch "$RUNNER_TEMP/asfalto-game.bundle" refs/heads/main:refs/remotes/imported/main
          test "$(git rev-parse refs/remotes/imported/main)" = "$EXPECTED_COMMIT"
          test "$(git ls-tree -r --name-only refs/remotes/imported/main | wc -l)" -eq 477
      - name: Importar el juego verificado a una rama nueva
        run: |
          test -z "$(git ls-remote --heads origin refs/heads/imported-asfalto-v6-20260908)"
          git push origin refs/remotes/imported/main:refs/heads/imported-asfalto-v6-20260908
          echo 'Juego completo verificado en imported-asfalto-v6-20260908; main no fue modificado por este proceso.' >> "$GITHUB_STEP_SUMMARY"
```
