import importlib.util
import pathlib
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import hashlib
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('release_server', pathlib.Path(__file__).parent.parent / 'server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StaticHTTPTest(unittest.TestCase):
    def test_cache_ranges_and_head(self):
        with tempfile.TemporaryDirectory(prefix='asfalto-http-') as root:
            pathlib.Path(root, 'data.json').write_bytes(b'hello world')
            server = ThreadingHTTPServer(('127.0.0.1', 0), module.make_handler(root))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            def request(headers=None, method='GET', suffix='data.json'):
                try:
                    return urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{server.server_port}/{suffix}', headers=headers or {}, method=method))
                except urllib.error.HTTPError as error:
                    return error
            try:
                with request() as response:
                    self.assertEqual(response.read(), b'hello world')
                    self.assertEqual(response.headers['Cache-Control'], 'no-cache')
                    etag = response.headers['ETag']
                    modified = response.headers['Last-Modified']
                with request({'If-None-Match': etag}) as response:
                    self.assertEqual(response.status, 304)
                with request({'If-Modified-Since': modified}) as response:
                    self.assertEqual(response.status, 304)
                with request({'Range': 'bytes=1-4'}) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.headers['Content-Range'], 'bytes 1-4/11')
                    self.assertEqual(response.read(), b'ello')
                with request({'Range': 'bytes=1-4', 'If-Range': 'Wed, 31 Dec 2099 00:00:00 GMT'}) as response:
                    self.assertEqual(response.status, 200)
                with request({'Range': 'bytes=1-4', 'If-Range': modified}) as response:
                    self.assertEqual(response.status, 206)
                with request({'Range': 'bytes=-5'}) as response:
                    self.assertEqual(response.read(), b'world')
                with request({'Range': 'bytes=99-'}) as response:
                    self.assertEqual(response.status, 416)
                with request({'Range': 'bytes=1-4'}, method='HEAD') as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers['Content-Length'], '11')
                    self.assertEqual(response.read(), b'')
                version = hashlib.sha256(b'hello world').hexdigest()[:16]
                with request(suffix='data.json?v=' + version) as response:
                    self.assertIn('immutable', response.headers['Cache-Control'])
                with request(suffix='data.json?v=0123456789abcdef') as response:
                    self.assertEqual(response.headers['Cache-Control'], 'no-cache')
                with request(suffix='%252e%252e/secret') as response:
                    self.assertEqual(response.status, 403)
            finally:
                server.shutdown()
                thread.join()
                server.server_close()

if __name__ == '__main__':
    unittest.main()
