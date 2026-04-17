#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import agentsoul.cli.install as _install  # noqa: E402

sys.modules[__name__] = _install

if __name__ == "__main__":
    _install.main()

