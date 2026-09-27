"""Servidor local restringido a la carpeta de la release."""
from __future__ import annotations

import argparse
import hashlib
from collections import OrderedDict
from email.utils import formatdate, parsedate_to_datetime
import os
import re
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit, parse_qs

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream',
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
    fingerprints = OrderedDict()

    def fingerprint(file, details):
        key = (file, details.st_size, details.st_mtime_ns, details.st_ctime_ns)
        if key not in fingerprints:
            with open(file, 'rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            fingerprints[key] = digest
            while len(fingerprints) > 512:
                fingerprints.popitem(last=False)
        return fingerprints[key]

    def date_seconds(value):
        try:
            return parsedate_to_datetime(value).timestamp()
        except (TypeError, ValueError, OverflowError):
            return -1

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
            details = os.stat(resolved)
            extension = os.path.splitext(resolved)[1].lower()
            version = parse_qs(urlsplit(self.path).query).get('v', [''])[0]
            digest = fingerprint(resolved, details) if re.fullmatch(r'[a-fA-F0-9]{16,64}', version) else None
            immutable = digest and digest.startswith(version.lower()) and extension not in ('.html', '.htm')
            etag = ('"' + digest + '"') if digest else f'W/"{details.st_size:x}-{details.st_mtime_ns:x}-{details.st_ctime_ns:x}"'
            modified = int(details.st_mtime)
            headers = {
                'Content-Type': MIME_TYPES.get(extension, 'application/octet-stream'),
                'Cache-Control': 'public, max-age=31536000, immutable' if immutable else 'no-cache',
                'ETag': etag, 'Last-Modified': formatdate(modified, usegmt=True),
                'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
            }
            none_match = self.headers.get('If-None-Match')
            not_modified = (any(v.strip() == '*' or v.strip().removeprefix('W/') == etag.removeprefix('W/') for v in none_match.split(','))
                            if none_match is not None else date_seconds(self.headers.get('If-Modified-Since')) >= modified)
            status, start, end = 200, 0, details.st_size - 1
            if not_modified:
                status = 304
            else:
                if_range = self.headers.get('If-Range')
                allow_range = not if_range or (digest and if_range == etag) or ('"' not in if_range and date_seconds(if_range) == modified)
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', '')) if body and allow_range else None
                if match:
                    first, last = match.groups()
                    if first:
                        start = int(first)
                        end = min(int(last), end) if last else end
                    elif last:
                        start = max(0, details.st_size - int(last))
                    if (not first and not last) or start > end or start >= details.st_size:
                        status = 416
                        headers['Content-Range'] = f'bytes */{details.st_size}'
                        headers['Content-Length'] = '0'
                    else:
                        status = 206
                        headers['Content-Range'] = f'bytes {start}-{end}/{details.st_size}'
                if status != 416:
                    headers['Content-Length'] = str(end - start + 1)
            self.send_response(status)
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            if body and status in (200, 206):
                try:
                    with open(resolved, 'rb') as file:
                        file.seek(start)
                        remaining = end - start + 1
                        while remaining > 0:
                            chunk = file.read(min(256 * 1024, remaining))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass

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