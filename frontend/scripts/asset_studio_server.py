#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import sys
import webbrowser

PORT = 8080
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public'))

class StudioHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/api/save-theme':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                target_file = os.path.join(WORKSPACE_ROOT, 'selected_master_theme.json')
                with open(target_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                # Also save to frontend/src/game/chosenTheme.json
                src_target = os.path.join(WORKSPACE_ROOT, 'wd2d2Pixi-main', 'frontend', 'src', 'game', 'chosenTheme.json')
                os.makedirs(os.path.dirname(src_target), exist_ok=True)
                with open(src_target, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = {'status': 'ok', 'savedTo': target_file}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print(f"[Studio Server] Successfully saved theme manifest to: {target_file}")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), StudioHTTPHandler) as httpd:
        url = f"http://127.0.0.1:{PORT}/asset-studio.html"
        print("================================================================")
        print(">> WATERDROP MASTER ASSET & THEME STUDIO SERVER IS RUNNING!")
        print(f">> OPEN IN BROWSER: {url}")
        print("================================================================")
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == '__main__':
    run_server()
