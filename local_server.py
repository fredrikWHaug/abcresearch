#!/usr/bin/env python3
"""
Local HTTP server for testing the PDF extraction API
This simulates how Vercel will call the handler function
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from api.extract_tables import handler

class MockVercelRequest:
    def __init__(self, method, body, headers=None):
        self.method = method
        self.body = body
        self.headers = headers or {}
        self.json = json.loads(body) if body else {}

class LocalHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/extract_tables':
            # Read request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            
            # Create mock Vercel request
            request = MockVercelRequest('POST', body.decode('utf-8'), dict(self.headers))
            
            # Call the handler
            response = handler(request)
            
            # Send response
            self.send_response(response['statusCode'])
            for key, value in response['headers'].items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(response['body'].encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def do_OPTIONS(self):
        if self.path == '/api/extract_tables':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=3000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, LocalHandler)
    print(f"🚀 Local server running on http://localhost:{port}")
    print(f"📄 PDF extraction API available at http://localhost:{port}/api/extract_tables")
    print("Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
