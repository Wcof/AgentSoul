#!/usr/bin/env python3
"""
Convert unittest tests to pytest style in a safe, precise way.
"""
from pathlib import Path
import re

TESTS_DIR = Path("tests")

# Patterns to replace - order matters!
REPLACEMENTS = [
    # 1. import unittest -> import pytest (only standalone import)
    (r'^import unittest$', 'import pytest'),
    
    # 2. from unittest.mock import ... -> from unittest.mock import ... (keep, pytest works with it)
    # No change needed
    
    # 3. class X(unittest.TestCase): -> class X:
    (r'\(unittest\.TestCase\)', ''),
    
    # 4. self.assertEqual(a, b) -> assert a == b
    (r'self\.assertEqual\(([^,]+),\s*([^)]+)\)', r'assert \1 == \2'),
    
    # 5. self.assertNotEqual(a, b) -> assert a != b
    (r'self\.assertNotEqual\(([^,]+),\s*([^)]+)\)', r'assert \1 != \2'),
    
    # 6. self.assertTrue(x) -> assert x
    (r'self\.assertTrue\(([^)]+)\)', r'assert \1'),
    
    # 7. self.assertFalse(x) -> assert not x
    (r'self\.assertFalse\(([^)]+)\)', r'assert not \1'),
    
    # 8. self.assertIn(a, b) -> assert a in b
    (r'self\.assertIn\(([^,]+),\s*([^)]+)\)', r'assert \1 in \2'),
    
    # 9. self.assertNotIn(a, b) -> assert a not in b
    (r'self\.assertNotIn\(([^,]+),\s*([^)]+)\)', r'assert \1 not in \2'),
    
    # 10. self.assertIsNone(x) -> assert x is None
    (r'self\.assertIsNone\(([^)]+)\)', r'assert \1 is None'),
    
    # 11. self.assertIsNotNone(x) -> assert x is not None
    (r'self\.assertIsNotNone\(([^)]+)\)', r'assert \1 is not None'),
    
    # 12. self.assertIsInstance(x, T) -> assert isinstance(x, T)
    (r'self\.assertIsInstance\(([^,]+),\s*([^)]+)\)', r'assert isinstance(\1, \2)'),
    
    # 13. self.assertGreater(a, b) -> assert a > b
    (r'self\.assertGreater\(([^,]+),\s*([^)]+)\)', r'assert \1 > \2'),
    
    # 14. self.assertLess(a, b) -> assert a < b
    (r'self\.assertLess\(([^,]+),\s*([^)]+)\)', r'assert \1 < \2'),
    
    # 15. self.assertGreaterEqual(a, b) -> assert a >= b
    (r'self\.assertGreaterEqual\(([^,]+),\s*([^)]+)\)', r'assert \1 >= \2'),
    
    # 16. self.assertLessEqual(a, b) -> assert a <= b
    (r'self\.assertLessEqual\(([^,]+),\s*([^)]+)\)', r'assert \1 <= \2'),
    
    # 17. self.assertNotEmpty(x) -> assert x
    (r'self\.assertNotEmpty\(([^)]+)\)', r'assert \1'),
    
    # 18. @unittest.skip -> @pytest.mark.skip
    (r'@unittest\.skip\(', r'@pytest.mark.skip('),
    
    # 19. @unittest.skipIf -> @pytest.mark.skipif
    (r'@unittest\.skipIf\(', r'@pytest.mark.skipif('),
    
    # 20. @unittest.expectedFailure -> @pytest.mark.xfail
    (r'@unittest\.expectedFailure', r'@pytest.mark.xfail'),
    
    # 21. Remove if __name__ == "__main__": unittest.main() block
    # Handled separately below
]

def convert_file(py_file: Path) -> bool:
    """Convert a single test file. Returns True if modified."""
    content = py_file.read_text(encoding="utf-8")
    original = content
    
    # Apply all replacements
    for pattern, replacement in REPLACEMENTS:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    # Remove if __name__ == "__main__": ... block (multi-line)
    content = re.sub(
        r'\n?if __name__ == ["\x27]__main__["\x27]:\n(?:\s+.+\n)*',
        '\n',
        content
    )
    
    if content != original:
        py_file.write_text(content, encoding="utf-8")
        return True
    return False

def main():
    modified_count = 0
    for py_file in TESTS_DIR.glob("*.py"):
        if convert_file(py_file):
            modified_count += 1
            print(f"  Converted: {py_file.name}")
    
    print(f"\nDone: {modified_count} files converted")

if __name__ == "__main__":
    main()
