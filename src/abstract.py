"""
AgentSoul · 统一存储抽象接口
=========================


text
统一抽象接口定义，支持：
- Claude MCP 链路实现
- OpenAI 链路实现
- 三层数据结构：人格 / 记忆 / 技能
- 注入失败回滚支持
- 记忆冲突检测与解决
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SoulVersion:
    """灵魂版本信息 - 用于版本追踪和回滚"""
    version: str
    timestamp: str
    checksum: Optional[str] = None
    description: Optional[str] = None


@dataclass
class MemoryConflict:
    """记忆冲突信息 - 用于冲突检测"""
    topic: str
    existing_content: str
    new_content: str
    conflict_type: str  # "timestamp", "content", "structure"
    resolution: Optional[str] = None


class BasePersonaStorage(ABC):
    """人格存储抽象接口 - AI身份和用户配置"""

    @abstractmethod
    def read_persona_config(self) -> Dict[str, Any]:
        """读取人格配置"""
        pass

    @abstractmethod
    def write_persona_config(self, config: Dict[str, Any]) -> bool:
        """写入人格配置"""
        pass

    @abstractmethod
    def get_version(self) -> SoulVersion:
        """获取当前人格版本"""
        pass


class BaseSoulStateStorage(ABC):
    """灵魂状态存储抽象接口 - PAD情感状态"""

    @abstractmethod
    def read_soul_state(self) -> Dict[str, Any]:
        """读取灵魂状态"""
        pass

    @abstractmethod
    def write_soul_state(self, state: Dict[str, Any]) -> bool:
        """写入灵魂状态"""
        pass

    @abstractmethod
    def rollback(self, to_version: str) -> bool:
        """回滚到指定版本"""
        pass


class BaseMemoryStorage(ABC):
    """记忆存储抽象接口 - 分层记忆系统"""

    @abstractmethod
    def read_daily_memory(self, date: str) -> Optional[str]:
        """读取日记忆"""
        pass

    @abstractmethod
    def write_daily_memory(self, date: str, content: str, append: bool = False) -> bool:
        """写入日记忆"""
        pass

    @abstractmethod
    def read_weekly_memory(self, year_week: str) -> Optional[str]:
        """读取周记忆"""
        pass

    @abstractmethod
    def write_weekly_memory(self, year_week: str, content: str, append: bool = False) -> bool:
        """写入周记忆"""
        pass

    @abstractmethod
    def read_monthly_memory(self, year_month: str) -> Optional[str]:
        """读取月记忆"""
        pass

    @abstractmethod
    def write_monthly_memory(self, year_month: str, content: str, append: bool = False) -> bool:
        """写入月记忆"""
        pass

    @abstractmethod
    def read_yearly_memory(self, year: str) -> Optional[str]:
        """读取年记忆"""
        pass

    @abstractmethod
    def write_yearly_memory(self, year: str, content: str, append: bool = False) -> bool:
        """写入年记忆"""
        pass

    @abstractmethod
    def read_topic_memory(self, topic: str) -> Optional[str]:
        """读取主题记忆"""
        pass

    @abstractmethod
    def write_topic_memory(self, topic: str, content: str, append: bool = False) -> bool:
        """写入主题记忆"""
        pass

    @abstractmethod
    def list_topics(self, status: str = "active") -> List[Dict[str, str]]:
        """列出所有主题"""
        pass

    @abstractmethod
    def archive_topic(self, topic: str) -> bool:
        """归档主题"""
        pass

    @abstractmethod
    def detect_conflict(self, topic: str, new_content: str) -> Optional[MemoryConflict]:
        """检测记忆冲突"""
        pass

    @abstractmethod
    def resolve_conflict(self, conflict: MemoryConflict, resolution: str) -> bool:
        """解决记忆冲突"""
        pass


class BaseSkillStorage(ABC):
    """技能存储抽象接口"""

    @abstractmethod
    def read_base_rule(self, name: str) -> Optional[str]:
        """读取基础规则"""
        pass

    @abstractmethod
    def list_available_rules(self) -> List[str]:
        """列出可用规则"""
        pass


class UnifiedSoulStorage:
    """统一灵魂存储 - 组合三层数据结构
    人格 + 灵魂状态 + 记忆 + 技能
    """

    def __init__(
        self,
        persona: BasePersonaStorage,
        soul_state: BaseSoulStateStorage,
        memory: BaseMemoryStorage,
        skills: BaseSkillStorage
    ):
        self.persona = persona
        self.soul_state = soul_state
        self.memory = memory
        self.skills = skills

    def get_full_context(self) -> Dict[str, Any]:
        """获取完整灵魂上下文"""
        return {
            "persona": self.persona.read_persona_config(),
            "soul_state": self.soul_state.read_soul_state(),
            "version": self.persona.get_version(),
        }


class InjectionRollback:
    """注入失败回滚管理器
    支持在注入过程失败时回滚到之前的状态
    """

    def __init__(self):
        self._snapshots: Dict[str, Tuple[str, Any]] = {}

    def snapshot(self, storage: BaseSoulStateStorage, snapshot_name: str) -> None:
        """创建当前状态的快照"""
        current_state = storage.read_soul_state()
        self._snapshots[snapshot_name] = (
            datetime.now().isoformat(),
            current_state
        )

    def rollback(self, storage: BaseSoulStateStorage, snapshot_name: str) -> bool:
        """回滚到指定快照"""
        if snapshot_name not in self._snapshots:
            return False
        _, state = self._snapshots[snapshot_name]
        return storage.write_soul_state(state)

    def list_snapshots(self) -> List[str]:
        """列出所有可用快照"""
        return list(self._snapshots.keys())
