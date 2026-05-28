from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture
def temp_dir():
    """创建临时目录，测试后自动清理"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_project_root(temp_dir):
    """创建临时项目根目录结构"""
    (temp_dir / "config").mkdir()
    (temp_dir / "data").mkdir()
    (temp_dir / "data" / "soul").mkdir()
    (temp_dir / "data" / "soul" / "soul_variable").mkdir()
    (temp_dir / "data" / "memories").mkdir()
    (temp_dir / "data" / "learning").mkdir()
    yield temp_dir


@pytest.fixture
def sample_persona_config(temp_project_root):
    """创建示例 persona.yaml 配置"""
    config_path = temp_project_root / "config" / "persona.yaml"
    config_path.write_text("""
agent:
  name: TestAgent
  nickname: 小测
  role: AI Assistant
  personality:
    - friendly
    - professional
  core_values:
    - user_privacy_protection
  interaction_style:
    tone: neutral
    language: chinese
    emoji_usage: minimal

master:
  name: 测试用户
  nickname:
    - 测试
  timezone: Asia/Shanghai
  labels:
    - developer
    - tester
""")
    yield config_path


@pytest.fixture
def sample_memory_file(temp_dir):
    """创建示例记忆文件"""
    memories_dir = temp_dir / "memories"
    memories_dir.mkdir()
    memory_file = memories_dir / "test_memory_001.json"
    memory_file.write_text('''{
  "memory_id": "test_memory_001",
  "content": "这是一个测试记忆内容",
  "tags": ["test", "sample"],
  "priority": "high",
  "created_at": "2024-01-15T10:30:00Z",
  "last_accessed": "2024-01-20T14:22:00Z"
}''')
    yield memory_file


@pytest.fixture
def sample_pad_state(temp_dir):
    """创建示例 PAD 情感状态"""
    learning_dir = temp_dir / "learning"
    learning_dir.mkdir()
    pad_file = learning_dir / "pad_state.json"
    pad_file.write_text('''{
  "pleasure": 0.3,
  "arousal": 0.2,
  "dominance": 0.3,
  "last_updated": "2024-01-15T10:30:00Z"
}''')
    yield pad_file


@pytest.fixture
def mock_logger(monkeypatch):
    """模拟 log 函数，避免测试输出污染"""
    calls = []

    def mock_log(message, level="INFO"):
        calls.append((message, level))

    try:
        monkeypatch.setattr("agentsoul.common.log", mock_log)
    except AttributeError:
        pass
    yield calls
