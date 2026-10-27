"""Serve the local parking app on loopback. Python 3.10+."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='빈자리 웹앱 로컬 실행')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be 1..65535')
    root = Path(__file__).resolve().parent / 'dist'
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(root)))
    print(f'빈자리: http://localhost:{args.port} — Ctrl+C로 종료', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
