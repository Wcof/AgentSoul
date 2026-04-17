from __future__ import annotations

from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_SRC_PACKAGE = _ROOT / "src" / "agentsoul"

# Make `python -m agentsoul.*` work from repository root without manual PYTHONPATH.
__path__ = [str(_SRC_PACKAGE)]

_init_file = _SRC_PACKAGE / "__init__.py"
exec(compile(_init_file.read_text(encoding="utf-8"), str(_init_file), "exec"))

