"""Servidor local restringido a la carpeta de la release."""
from __future__ import annotations

import argparse
import os
import re
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.av3hdri': 'application/octet-stream',
}


def decode_path(raw_path: str) -> list[str] | None:
    path_only = re.split(r'[?#]', raw_path, maxsplit=1)[0]
    if not path_only.startswith('/') or path_only.startswith('//'):
        return None
    decoded = path_only
    for attempt in range(5):
        if re.search(r'%(?![0-9A-Fa-f]{2})', decoded):
            return None
        try:
            next_value = unquote(decoded, encoding='utf-8', errors='strict')
        except UnicodeDecodeError:
            return None
        if next_value == decoded:
            break
        decoded = next_value
        if attempt == 4:
            return None
    if decoded.startswith('//') or '\x00' in decoded or '\\' in decoded:
        return None
    segments = [segment for segment in decoded.split('/') if segment]
    if not segments:
        segments.append('index.html')
    if any(segment in ('.', '..') or re.match(r'^[A-Za-z]:', segment) for segment in segments):
        return None
    return segments


def within(root: str, candidate: str) -> bool:
    try:
        return os.path.commonpath((root, candidate)) == root
    except ValueError:
        return False


def make_handler(root: str):
    class ReleaseHandler(BaseHTTPRequestHandler):
        def _serve(self, body: bool) -> None:
            segments = decode_path(self.path)
            if segments is None:
                self._text(403, 'Forbidden')
                return
            requested = os.path.abspath(os.path.join(root, *segments))
            if not within(root, requested):
                self._text(403, 'Forbidden')
                return
            resolved = os.path.realpath(requested)
            if not within(root, resolved):
                self._text(403, 'Forbidden')
                return
            if not os.path.isfile(resolved):
                self._text(404, 'Not Found')
                return
            extension = os.path.splitext(resolved)[1].lower()
            mime_type = MIME_TYPES.get(extension, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(os.path.getsize(resolved)))
            if extension in ('.js', '.mjs', '.json'):
                self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if body:
                with open(resolved, 'rb') as file:
                    self.wfile.write(file.read())

        def _text(self, status: int, message: str, headers: dict[str, str] | None = None) -> None:
            encoded = message.encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(encoded)

        def do_GET(self) -> None:
            self._serve(True)

        def do_HEAD(self) -> None:
            self._serve(False)

        def _unsupported(self) -> None:
            self._text(405, 'Method Not Allowed', {'Allow': 'GET, HEAD'})

        def __getattr__(self, name: str):
            if name.startswith('do_'):
                return self._unsupported
            raise AttributeError(name)

        def do_POST(self) -> None:
            self._unsupported()

        do_PUT = do_POST
        do_PATCH = do_POST
        do_DELETE = do_POST
        do_OPTIONS = do_POST
        do_TRACE = do_POST
        do_CONNECT = do_POST

        def log_message(self, _format: str, *_args: object) -> None:
            pass

    return ReleaseHandler


def main() -> int:
    parser = argparse.ArgumentParser(description='Servidor local de Asfalto Nacional')
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('Puerto invalido.')
    root = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(root))
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Juego disponible en {url}', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())