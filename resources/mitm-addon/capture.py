"""mitmdump addon; stdout is a token-authenticated, bounded NDJSON transport."""
import json
import asyncio
import base64
import os
import sys
import threading
import time
import weakref
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mitmproxy import ctx
from traffic_record import FlowCapture
from traffic_body import BodyPreview
from traffic_diagnostics import build_diagnostic
from traffic_source import resolve_source


class TrafficCapture:
    def __init__(self):
        self.token = os.environ.get("TRAFFIC_SESSION_TOKEN", "")
        self.upstream = os.environ.get("TRAFFIC_UPSTREAM_PROXY", "")
        self.scope_pids = {int(pid) for pid in os.environ.get("TRAFFIC_SCOPE_PIDS", "").split(",") if pid}
        self.full_bodies = os.environ.get("TRAFFIC_FULL_BODIES") == "1"
        self.flows = weakref.WeakKeyDictionary()
        self.sources = weakref.WeakKeyDictionary()
        self.sequence = 0
        self.stopped = False
        self.diagnostic_window = 0
        self.diagnostic_count = 0

    def emit(self, event):
        if self.stopped:
            return
        event["token"] = self.token
        print("TRAFFIC_EVENT:" + json.dumps(event, ensure_ascii=True, separators=(",", ":")), flush=True)

    def running(self):
        if not self.token:
            raise ValueError("TRAFFIC_SESSION_TOKEN is required")
        master = ctx.master

        def read_commands():
            while True:
                line = sys.stdin.buffer.readline(4097)
                if not line:
                    master.shutdown()
                    return
                if len(line) > 4096:
                    continue
                try:
                    command = json.loads(line)
                    if command.get("token") == self.token and command.get("command") == "shutdown":
                        master.shutdown()
                        return
                except (ValueError, AttributeError):
                    pass

        threading.Thread(target=read_commands, name="traffic-control", daemon=True).start()
        # ScriptLoader's running hook precedes TlsConfig.running in mitmproxy 12.
        # Defer one event-loop turn so CA generation and all running hooks finish.
        asyncio.get_running_loop().call_soon(self.announce_ready)

    def announce_ready(self):
        certificate = Path(ctx.options.confdir).expanduser() / "mitmproxy-ca-cert.pem"
        if not certificate.is_file():
            self.emit({"type": "error", "error": "Capture CA was not generated during engine startup"})
            ctx.master.shutdown()
            return
        self.emit({"type": "ready"})

    def requestheaders(self, flow):
        if not self.in_scope(flow.client_conn):
            flow.request.stream = True
            return
        # HTTP layer consumes server_conn.via when constructing the upstream CONNECT
        # stack. Lazy connections ensure this happens after this hook, even in local mode.
        if self.upstream:
            proxy = urlsplit(self.upstream)
            flow.server_conn.via = (proxy.scheme, (proxy.hostname, proxy.port or (443 if proxy.scheme == "https" else 80)))
        self.sequence += 1
        capture = FlowCapture(self.sequence, flow.request.headers, self.sources.get(flow.client_conn))
        self.flows[flow] = capture
        flow.request.stream = self.build_stream(flow, capture.request, "request", flow.request.headers)
        self.publish(flow)

    def report_diagnostic(self, kind, message, client, server=None):
        if not self.in_scope(client):
            return
        window = int(time.monotonic())
        if window != self.diagnostic_window:
            self.diagnostic_window, self.diagnostic_count = window, 0
        # Bound stdout traffic even when an app repeatedly reconnects after TLS errors.
        if self.diagnostic_count >= 40:
            return
        self.diagnostic_count += 1
        self.emit({"type": "diagnostic", "diagnostic": build_diagnostic(kind, message, client, server)})

    def client_connected(self, client):
        self.sources[client] = resolve_source(client)
        self.report_diagnostic("connection", "Client transport connected to capture engine", client)

    def in_scope(self, client):
        return not self.scope_pids or (self.sources.get(client) or {}).get("pid") in self.scope_pids

    def tls_clienthello(self, data):
        if not self.in_scope(data.context.client):
            data.ignore_connection = True

    def tls_failed_client(self, data):
        detail = data.conn.error or "TLS handshake failed"
        self.report_diagnostic("tls-client-failed", f"Client TLS failed: {detail}. Verify CA trust; certificate pinning may prevent inspection.", data.context.client, data.context.server)

    def tls_failed_server(self, data):
        detail = data.conn.error or "TLS handshake failed"
        self.report_diagnostic("tls-server-failed", f"Upstream TLS failed: {detail}", data.context.client, data.context.server)

    def tcp_start(self, flow):
        self.report_diagnostic("non-http", "TCP connection detected; payload is not decoded as HTTP", flow.client_conn, flow.server_conn)

    def udp_start(self, flow):
        self.report_diagnostic("non-http", "UDP connection detected; HTTP/3 and non-HTTP payloads are not inspected", flow.client_conn, flow.server_conn)

    def build_stream(self, flow, preview, side, headers):
        reference = weakref.ref(flow)
        content_encoding = headers.get("content-encoding", "")[:128]
        content_type = headers.get("content-type", "")[:512]
        flow_id = flow.id

        def stream(chunk):
            if self.full_bodies:
                preview.bytes += len(chunk)
                for offset in range(0, len(chunk), 48 * 1024):
                    self.emit({"type": "body", "chunk": {
                        "id": flow_id, "side": side,
                        "data": base64.b64encode(chunk[offset:offset + 48 * 1024]).decode("ascii"),
                        "contentEncoding": content_encoding, "contentType": content_type,
                    }})
            else:
                preview.append(chunk)
            active = reference()
            if active is not None:
                self.publish(active, throttle=True)
            return chunk

        return stream

    def responseheaders(self, flow):
        capture = self.flows.get(flow)
        if capture:
            content_type = flow.response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            capture.response = BodyPreview(flow.response.headers, sse=content_type == "text/event-stream")
            flow.response.stream = self.build_stream(flow, capture.response, "response", flow.response.headers)
            self.publish(flow)
        else:
            # Never permit an uncaptured large response to be buffered by mitmdump.
            flow.response.stream = True

    def request(self, flow):
        self.publish(flow)

    def response(self, flow):
        if flow.websocket is not None:
            self.publish(flow)
            return
        self.publish(flow, state="complete")
        self.flows.pop(flow, None)

    def error(self, flow):
        self.publish(flow, state="failed")
        self.flows.pop(flow, None)

    def publish(self, flow, state="pending", throttle=False):
        capture = self.flows.get(flow)
        if not capture:
            return
        now = time.monotonic()
        delay = 0.25 - (now - capture.last_emit)
        if throttle and delay > 0:
            if capture.pending_emit is None:
                reference = weakref.ref(flow)

                def publish_latest():
                    active = reference()
                    if active is not None:
                        self.publish(active)

                capture.pending_emit = asyncio.get_running_loop().call_later(delay, publish_latest)
            return
        if capture.pending_emit is not None:
            capture.pending_emit.cancel()
            capture.pending_emit = None
        capture.last_emit = now
        self.emit({"type": "record", "record": capture.build_record(flow, state)})

    def websocket_message(self, flow):
        capture = self.flows.get(flow)
        if capture:
            capture.add_websocket_message(flow.websocket.messages[-1])
            self.publish(flow, throttle=True)
        flow.websocket.messages.clear()

    def websocket_end(self, flow):
        self.publish(flow, state="failed" if flow.error else "complete")
        self.flows.pop(flow, None)

    def tcp_message(self, flow):
        flow.messages.clear()

    def udp_message(self, flow):
        flow.messages.clear()

    def done(self):
        self.stopped = True
        for capture in self.flows.values():
            if capture.pending_emit is not None:
                capture.pending_emit.cancel()
        self.flows.clear()
        self.sources.clear()


addons = [TrafficCapture()]
