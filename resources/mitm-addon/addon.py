"""Stable deployment entry point for the capture addon."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture import addons
