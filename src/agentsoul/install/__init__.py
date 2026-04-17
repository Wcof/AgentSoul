from __future__ import annotations

import sys

import agentsoul.cli.install as _install

# Some test paths mutate sys.path and resolve `import install` to this package.
# Alias this module object to the real installer implementation so monkeypatching
# and attribute access behave exactly the same as importing root-level install.py.
sys.modules[__name__] = _install
