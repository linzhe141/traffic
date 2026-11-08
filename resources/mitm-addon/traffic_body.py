"""A streaming preview: memory is bounded independently of message size."""
import base64
import codecs
from traffic_decode import create_preview_decoder, DECODE_ERRORS

PREVIEW_LIMIT = 64 * 1024


class BodyPreview:
    def __init__(self, headers=None, *, sse=False):
        self.preview = bytearray()
        self.raw_preview = bytearray()
        self.bytes = 0
        self.decoded_truncated = False
        self.failed_decode = False
        encoding = (headers or {}).get("content-encoding", "identity").lower().strip()
        self.compressed = encoding not in ("identity", "")
        self.sse = sse
        self.tail = sse and not self.compressed
        self.decoder = create_preview_decoder(encoding)
        if self.compressed and self.decoder is None:
            self.failed_decode = True

    def append(self, chunk: bytes):
        # mitmproxy ends a stream with b""; completed Zstd frames reject further input.
        if not chunk:
            return
        self.bytes += len(chunk)
        if self.tail:
            self.preview.extend(chunk[-PREVIEW_LIMIT:])
            del self.preview[:-PREVIEW_LIMIT]
            return
        raw_remaining = PREVIEW_LIMIT - len(self.raw_preview)
        if raw_remaining > 0:
            self.raw_preview.extend(chunk[:raw_remaining])
        if self.compressed:
            self.append_decoded(chunk)
            return
        remaining = PREVIEW_LIMIT - len(self.preview)
        if remaining > 0:
            self.preview.extend(chunk[:remaining])

    def append_decoded(self, chunk):
        if self.failed_decode or self.decoder is None:
            return
        remaining = PREVIEW_LIMIT - len(self.preview)
        try:
            # max_length is essential: a tiny compressed chunk may expand to gigabytes.
            decoded = self.decoder.decompress(chunk, remaining + 1)
            self.preview.extend(decoded[:remaining])
            if len(decoded) > remaining or self.decoder.unused_data:
                self.decoded_truncated = True
                self.decoder = None
        except DECODE_ERRORS:
            self.failed_decode = True
            self.decoder = None

    def snapshot(self, headers):
        data = bytes(self.raw_preview if self.failed_decode else self.preview)
        content_type = headers.get("content-type", "").lower()
        controls = any(value < 32 and value not in (9, 10, 13) for value in data)
        binary = self.failed_decode or controls or content_type.startswith(("image/", "audio/", "video/", "application/octet-stream", "application/pdf"))
        try:
            text = codecs.utf_8_decode(data, "replace", False)[0] if self.sse and not binary else data.decode("utf-8")
        except UnicodeDecodeError:
            binary = True
            text = ""
        encoding = "base64" if binary else "utf8"
        if binary:
            text = base64.b64encode(data).decode("ascii")
        truncated = self.decoded_truncated if self.compressed and not self.failed_decode else self.bytes > len(data)
        result = {"text": text, "bytes": self.bytes, "truncated": truncated, "encoding": encoding}
        if self.tail:
            result["tail"] = True
        return result
