"""Streaming compression adapters with bounded preview output, never full-body decode."""
import zlib
import brotli
try:
    from compression import zstd
except ImportError:
    from backports import zstd


DECODE_ERRORS = (zlib.error, brotli.error, zstd.ZstdError, EOFError)


class BrotliPreviewDecoder:
    def __init__(self):
        self.decoder = brotli.Decompressor()
        self.unused_data = b""

    def decompress(self, data, max_length):
        chunks = []
        produced = 0
        while True:
            # Brotli's limit is a growth threshold, not a strict return-size cap.
            # A threshold of 1 yields one small internal output block at a time.
            output = self.decoder.process(data, output_buffer_limit=1)
            remaining = max_length - produced
            chunks.append(output[:remaining])
            produced += min(len(output), remaining)
            if produced >= max_length or self.decoder.can_accept_more_data():
                break
            data = b""
        return b"".join(chunks)


class ZstdPreviewDecoder:
    def __init__(self):
        # Reject frames requiring huge history buffers, rather than allocating
        # arbitrary memory based on an untrusted frame header. 8 MiB is sufficient
        # for typical HTTP content; unsupported frames fall back to raw base64.
        self.decoder = zstd.ZstdDecompressor(options={zstd.DecompressionParameter.window_log_max: 23})

    @property
    def unused_data(self):
        return self.decoder.unused_data

    def decompress(self, data, max_length):
        return self.decoder.decompress(data, max_length=max_length)


def create_preview_decoder(encoding):
    if encoding in ("gzip", "x-gzip", "deflate"):
        return zlib.decompressobj(16 + zlib.MAX_WBITS if encoding != "deflate" else zlib.MAX_WBITS)
    if encoding == "br":
        return BrotliPreviewDecoder()
    if encoding == "zstd":
        return ZstdPreviewDecoder()
    return None
