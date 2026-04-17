from __future__ import annotations

import sys

import agentsoul.config.config_manager.cli as _impl

sys.modules[__name__] = _impl

if __name__ == "__main__":
    _impl.main()
