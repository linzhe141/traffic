"""Conversion from mitmproxy flows into the renderer's transport DTO."""
import base64
from collections import deque
import time
from urllib.parse import urlsplit
from traffic_body import BodyPreview
from wsproto.frame_protocol import Opcode


def build_headers(headers):
    result = []
    remaining = 32768
    for name, value in headers.items(multi=True):
        name, value = name[:1024], value[:8192]
        remaining -= len(name) + len(value)
        if remaining < 0 or len(result) >= 256:
            break
        result.append({"name": name, "value": value})
    return result


class FlowCapture:
    def __init__(self, sequence, request_headers=None, source_app=None):
        self.sequence = sequence
        self.source_app = source_app
        self.request = BodyPreview(request_headers)
        self.response = BodyPreview()
        self.last_emit = 0.0
        self.pending_emit = None
        self.messages = deque(maxlen=64)
        self.message_count = 0

    def add_websocket_message(self, message):
        self.message_count += 1
        content = message.content[:1024]
        is_text = message.type == Opcode.TEXT
        self.messages.append({
            "sequence": self.message_count,
            "direction": "sent" if message.from_client else "received",
            "timestamp": message.timestamp * 1000,
            "bytes": len(message.content),
            "encoding": "utf8" if is_text else "base64",
            "text": content.decode("utf-8", errors="replace") if is_text else base64.b64encode(content).decode("ascii"),
        })

    def build_record(self, flow, state="pending"):
        request, response = flow.request, flow.response
        url = request.pretty_url
        started = request.timestamp_start or time.time()
        peer = flow.client_conn.peername
        record = {
            "id": flow.id, "sequence": self.sequence, "method": request.method[:64],
            "url": url[:16384], "host": urlsplit(url).netloc[:1024], "path": request.path[:16384],
            "protocol": request.http_version[:64], "kind": "http", "state": state,
            "startedAt": max(0, started * 1000), "durationMs": max(0, (time.time() - started) * 1000),
            "statusCode": response.status_code if response else None,
            "requestHeaders": build_headers(request.headers),
            "responseHeaders": build_headers(response.headers) if response else [],
            "requestBody": self.request.snapshot(request.headers),
            "responseBody": self.response.snapshot(response.headers if response else {}),
            "clientAddress": f"{peer[0]}:{peer[1]}" if peer else "unknown",
        }
        if self.source_app:
            record["sourceApp"] = self.source_app
        if flow.websocket is not None:
            record["websocket"] = {
                "messages": list(self.messages),
                "messageCount": self.message_count,
                "closeCode": flow.websocket.close_code,
            }
        if flow.error:
            record["error"] = str(flow.error)[:8192]
        return record
