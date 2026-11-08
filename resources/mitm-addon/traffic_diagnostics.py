"""Non-fatal transport diagnostics, including connections with no HTTP flow."""
import time
import uuid


def build_diagnostic(kind, message, client, server=None):
    peer = getattr(client, "peername", None)
    address = getattr(server, "address", None) if server else None
    host = getattr(client, "sni", None) or (address[0] if address else "")
    return {
        "id": str(uuid.uuid4()), "kind": kind, "message": str(message)[:2048],
        "clientAddress": f"{peer[0]}:{peer[1]}"[:1024] if peer else "unknown",
        "host": str(host)[:1024], "timestamp": time.time() * 1000,
    }
