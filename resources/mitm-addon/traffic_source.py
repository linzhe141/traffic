"""Resolve the process that owns a client connection."""
import os
import socket
import sys

from mitmproxy import ctx
from mitmproxy.proxy import mode_specs

if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class TcpRow(ctypes.Structure):
        _fields_ = [(field, wintypes.DWORD) for field in (
            "state", "local_addr", "local_port", "remote_addr", "remote_port", "pid"
        )]

    get_tcp_table = ctypes.WinDLL("iphlpapi").GetExtendedTcpTable
    get_tcp_table.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(wintypes.DWORD), wintypes.BOOL,
        wintypes.ULONG, ctypes.c_int, wintypes.ULONG,
    ]
    get_tcp_table.restype = wintypes.DWORD

    kernel = ctypes.WinDLL("kernel32")
    open_process = kernel.OpenProcess
    open_process.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    open_process.restype = wintypes.HANDLE
    query_image = kernel.QueryFullProcessImageNameW
    query_image.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD),
    ]
    query_image.restype = wintypes.BOOL
    close_handle = kernel.CloseHandle
    close_handle.argtypes = [wintypes.HANDLE]
    close_handle.restype = wintypes.BOOL


def windows_tcp_owner(peer, listener):
    # Regular mode listens on IPv4 loopback. Read the client-side row, whose
    # local and remote endpoints are reversed relative to the accepted socket.
    local_ip = int.from_bytes(socket.inet_aton(peer[0]), "little")
    remote_ip = int.from_bytes(socket.inet_aton(listener[0]), "little")
    local_port = socket.htons(peer[1])
    remote_port = socket.htons(listener[1])
    size = wintypes.DWORD(0)
    table = None
    for _ in range(3):
        result = get_tcp_table(table, ctypes.byref(size), False, socket.AF_INET, 5, 0)
        if result == 0:
            break
        if result != 122 or not 4 <= size.value <= 16 * 1024 * 1024:
            return None
        table = ctypes.create_string_buffer(size.value)
    else:
        return None

    if table is None or size.value < 4:
        return None
    count = wintypes.DWORD.from_buffer(table).value
    row_size = ctypes.sizeof(TcpRow)
    if count > (len(table) - 4) // row_size:
        return None
    for row in (TcpRow * count).from_buffer(table, 4):
        if (row.local_addr, row.local_port & 0xffff, row.remote_addr, row.remote_port & 0xffff) == (
            local_ip, local_port, remote_ip, remote_port
        ) and row.pid and row.state != 11:  # Skip TIME_WAIT.
            return row.pid
    return None


def windows_image(pid):
    handle = open_process(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return None
    try:
        size = wintypes.DWORD(32768)
        path = ctypes.create_unicode_buffer(size.value)
        if query_image(handle, 0, path, ctypes.byref(size)):
            return path.value
    finally:
        close_handle(handle)
    return None


def resolve_source(client):
    pid = process_name = None
    try:
        if isinstance(client.proxy_mode, mode_specs.LocalMode):
            # mitmproxy 12 keeps redirector metadata on the stream rather than
            # copying it to Client. The handler is registered before this hook.
            proxyserver = ctx.master.addons.get("proxyserver")
            handler = proxyserver.connections.get(client.id)
            if handler is not None:
                writer = handler.transports[client].writer
                pid = writer.get_extra_info("pid", None)
                process_name = writer.get_extra_info("process_name", None)
        elif (sys.platform == "win32" and isinstance(client.proxy_mode, (mode_specs.RegularMode, mode_specs.UpstreamMode))
              and client.transport_protocol == "tcp" and client.peername and client.sockname):
            pid = windows_tcp_owner(client.peername, client.sockname)
    except (AttributeError, KeyError, OSError, ValueError, OverflowError):
        return None

    pid = pid if type(pid) is int and 0 < pid <= 0xffffffff else None
    process_name = process_name if isinstance(process_name, str) else None
    if not pid and not process_name:
        return None
    path = windows_image(pid) if pid and sys.platform == "win32" else None
    if not path and process_name and os.path.isabs(process_name):
        path = process_name
    name = os.path.basename(path or process_name or "") or f"PID {pid}"
    source = {"name": name[:256]}
    if pid:
        source["pid"] = pid
    if path and len(path) <= 4096:
        source["executablePath"] = path
    return source
