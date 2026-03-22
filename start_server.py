import http.server
import socketserver
from pathlib import Path

PORT = 3000
DATA_FILE = Path(__file__).parent / "data" / "research_data.md"

class RawTextHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain; charset=utf-8")
        self.end_headers()
        try:
            if DATA_FILE.exists():
                content = DATA_FILE.read_text(encoding="utf-8")
                self.wfile.write(content.encode("utf-8"))
            else:
                self.wfile.write(b"No research data found yet.")
        except Exception as e:
            self.wfile.write(f"Error reading file: {e}".encode("utf-8"))

    # Suppress console logging for every request
    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    with socketserver.TCPServer(("127.0.0.1", PORT), RawTextHandler) as httpd:
        print(f"Serving research data at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
