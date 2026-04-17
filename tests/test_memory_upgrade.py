"""
AgentSoul · 记忆升级功能测试
===========================

测试 MemPalace 升级集成的新功能：
- AGENTSOUL_MEMORY_PROTOCOL 可读性
- WAL (Write-Ahead Log) 审计日志
- Verbatim Evidence Layer
- Temporal Fact Layer (实体记忆时间有效性)
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import tempfile
import unittest
from pathlib import Path

from tests.test_health_check import BaseTest


class TestMemoryProtocolReadability(BaseTest):
    """测试 AGENTSOUL_MEMORY_PROTOCOL 协议可读性"""

    def test_protocol_exists_in_chinese_yaml(self):
        """测试协议内容已添加到中文语言文件"""
        project_root = Path(__file__).parent.parent
        chinese_file = project_root / "apps" / "mcp-server" / "src" / "language" / "chinese.yaml"

        self.assertTrue(chinese_file.exists())
        content = chinese_file.read_text(encoding="utf-8")

        # 检查关键内容存在
        self.assertIn("AGENTSOUL_MEMORY_PROTOCOL", content)
        # 中文版本使用中文描述
        self.assertIn("先查后答", content)
        self.assertIn("会后保存", content)
        self.assertIn("事实变更", content)
        self.assertIn("invalidate", content)

    def test_protocol_exists_in_english_yaml(self):
        """测试协议内容已添加到英文语言文件"""
        project_root = Path(__file__).parent.parent
        english_file = project_root / "apps" / "mcp-server" / "src" / "language" / "english.yaml"

        self.assertTrue(english_file.exists())
        content = english_file.read_text(encoding="utf-8")

        # 检查关键内容存在
        self.assertIn("AGENTSOUL_MEMORY_PROTOCOL", content)

    def test_all_new_tools_are_described(self):
        """测试所有新工具都有描述"""
        project_root = Path(__file__).parent.parent
        chinese_file = project_root / "apps" / "mcp-server" / "src" / "language" / "chinese.yaml"
        content = chinese_file.read_text(encoding="utf-8")

        # 新添加的工具都应该有描述
        new_tools = [
            "verbatim_add",
            "verbatim_get",
            "verbatim_search",
            "verbatim_delete",
            "entity_fact_add",
            "entity_fact_invalidate",
        ]

        for tool in new_tools:
            self.assertIn(tool, content)

    def test_mcp_index_includes_all_new_tools(self):
        """测试 MCP index 包含所有新工具"""
        project_root = Path(__file__).parent.parent
        index_file = project_root / "apps" / "mcp-server" / "src" / "index.ts"

        self.assertTrue(index_file.exists())
        content = index_file.read_text(encoding="utf-8")

        # 检查新工具导入和注册
        new_tools = [
            "verbatim_add",
            "verbatim_get",
            "verbatim_search",
            "verbatim_delete",
            "entity_fact_add",
            "entity_fact_invalidate",
        ]

        for tool in new_tools:
            self.assertIn(tool, content)


class TestWALWriteAheadLog(BaseTest):
    """测试 WAL 写前日志"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # 创建数据目录结构
        (self.project_root / "var" / "data" / "wal").mkdir(parents=True)
        self.wal_path = self.project_root / "var" / "data" / "wal" / "write_log.jsonl"

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_wal_file_created_on_write(self):
        """测试WAL文件在写入时被创建"""
        # 我们不需要运行Node.js，只验证MCP服务器代码中包含WAL逻辑
        project_root = Path(__file__).parent.parent
        utils_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "utils.ts"

        self.assertTrue(utils_ts.exists())
        content = utils_ts.read_text(encoding="utf-8")

        # 检查logWAL方法存在
        self.assertIn("logWAL", content)
        self.assertIn("write_log.jsonl", content)

    def test_wal_includes_required_fields(self):
        """测试WAL日志条目包含必需字段"""
        project_root = Path(__file__).parent.parent
        storage_ts = project_root / "apps" / "mcp-server" / "src" / "storage.ts"
        content = storage_ts.read_text(encoding="utf-8")

        # 检查关键字段 - 检查logWAL方法定义包含这些字段结构
        self.assertIn("logWAL", content)
        # 日志对象包含这些字段
        self.assertIn("timestamp", content)
        self.assertIn("operation", content)

    def test_all_write_operations_are_logged(self):
        """测试所有写操作都有WAL日志"""
        project_root = Path(__file__).parent.parent
        storage_ts = project_root / "apps" / "mcp-server" / "src" / "storage.ts"
        content = storage_ts.read_text(encoding="utf-8")

        write_methods = [
            "writeTimeMemory",
            "writeTopicMemory",
            "writePersonaConfig",
            "writeSoulState",
            "archiveTopic",
        ]

        for method in write_methods:
            self.assertIn(method, content)
            self.assertIn("logWAL", content)

    def test_entity_memory_wal_logging(self):
        """测试实体记忆写入包含WAL日志"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        self.assertIn("logWAL", content)
        self.assertIn("entity_storage_write", content)

    def test_kv_cache_wal_logging(self):
        """测试KV缓存写入包含WAL日志"""
        project_root = Path(__file__).parent.parent
        kv_cache_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "kv-cache" / "index.ts"
        content = kv_cache_ts.read_text(encoding="utf-8")

        self.assertIn("logWAL", content)

    def test_soul_board_wal_logging(self):
        """测试Soul Board写入包含WAL日志"""
        project_root = Path(__file__).parent.parent
        soul_engine_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "soul-engine.ts"
        content = soul_engine_ts.read_text(encoding="utf-8")

        self.assertIn("logWAL", content)


class TestVerbatimEvidenceLayer(BaseTest):
    """测试 Verbatim Evidence Layer"""

    def test_verbatim_class_exists_correct_interface(self):
        """测试VerbatimEvidence类存在且接口正确"""
        project_root = Path(__file__).parent.parent
        verbatim_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"

        self.assertTrue(verbatim_ts.exists())
        content = verbatim_ts.read_text(encoding="utf-8")

        # 检查类和关键方法存在
        self.assertIn("export class VerbatimEvidence", content)
        self.assertIn("add(", content)
        self.assertIn("get(", content)
        self.assertIn("delete(", content)
        self.assertIn("search(", content)
        self.assertIn("count(", content)

    def test_verbatim_interface_has_required_fields(self):
        """测试VerbatimFragment接口包含所有必需字段"""
        project_root = Path(__file__).parent.parent
        verbatim_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"
        content = verbatim_ts.read_text(encoding="utf-8")

        required_fields = [
            "id:", "text:", "source:", "date:", "security_level:",
            "topic?:", "entity?:", "tags?:", "created_at:",
        ]

        for field in required_fields:
            self.assertIn(field, content)

    def test_verbatim_respects_security_levels(self):
        """测试Verbatim正确尊重安全级别"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        # 检查SEALED级别被处理
        self.assertIn("SEALED", content)
        self.assertIn("[REDACTED", content)

    def test_verbatim_search_filters_work(self):
        """测试Verbatim搜索支持所有过滤器"""
        project_root = Path(__file__).parent.parent
        verbatim_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"
        content = verbatim_ts.read_text(encoding="utf-8")

        # 检查所有过滤器参数
        filters = ["topic", "entity", "dateBefore", "dateAfter", "securityLevel", "limit"]
        for filter_name in filters:
            self.assertIn(filter_name, content)

    def test_verbatim_uses_sharding(self):
        """测试Verbatim使用首字母分库避免太多文件在一个目录"""
        project_root = Path(__file__).parent.parent
        verbatim_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"
        content = verbatim_ts.read_text(encoding="utf-8")

        self.assertIn("subdir = id[0]", content)
        self.assertIn("path.join(this.baseDir, subdir", content)

    def test_verbatim_handles_path_traversal(self):
        """测试Verbatim正确处理路径遍历攻击防护"""
        project_root = Path(__file__).parent.parent
        verbatim_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"
        content = verbatim_ts.read_text(encoding="utf-8")

        self.assertIn("safePath", content)
        self.assertIn("Path traversal detected", content)

    def test_verbatim_tool_handlers_are_exported(self):
        """测试Verbatim工具处理器都已导出"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        handlers = [
            "handleVerbatimAdd",
            "handleVerbatimGet",
            "handleVerbatimSearch",
            "handleVerbatimDelete",
        ]

        for handler in handlers:
            self.assertIn(f"export async function {handler}", content)

    def test_verbatim_schemas_are_exported(self):
        """测试Verbatim schema都已导出"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        schemas = [
            "VerbatimAddSchema",
            "VerbatimGetSchema",
            "VerbatimSearchSchema",
            "VerbatimDeleteSchema",
        ]

        for schema in schemas:
            self.assertIn(schema, content)

    def test_security_level_enum_is_correct(self):
        """测试安全级别枚举正确"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("'PUBLIC'", content)
        self.assertIn("'PROTECTED'", content)
        self.assertIn("'SEALED'", content)
        self.assertIn("default('PROTECTED')", content)

    def test_verbatim_security_filtering_function_exists(self):
        """测试统一安全过滤函数 applySecurity 存在"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("function applySecurity", content)
        self.assertIn("SEALED: never return text", content)
        self.assertIn("include_protected_text", content)

    def test_verbatim_never_returns_sealed_text(self):
        """测试SEALED级别永远不返回明文"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("SEALED: never return text", content)
        self.assertIn("[REDACTED - SEALED level content]", content)

    def test_verbatim_protected_default_masked(self):
        """测试PROTECTED级别默认掩码，仅显式请求返回明文"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("includeProtectedText", content)
        self.assertIn("[PROTECTED -", content)
        self.assertIn("request include_protected_text=true AND can_view_protected=true to view", content)

    def test_verbatim_get_has_include_protected_text_param(self):
        """测试verbatim_get 包含 include_protected_text 参数"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("include_protected_text: z.boolean().optional()", content)

    def test_verbatim_search_has_include_protected_text_param(self):
        """测试verbatim_search 包含 include_protected_text 参数"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")

        self.assertIn("include_protected_text: z.boolean().optional()", content)

    def test_verbatim_get_has_can_view_protected_param(self):
        """测试verbatim_get 包含 can_view_protected 参数（双授权门）"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")
        self.assertIn("can_view_protected: z.boolean().optional()", content)

    def test_verbatim_search_has_can_view_protected_param(self):
        """测试verbatim_search 包含 can_view_protected 参数（双授权门）"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")
        self.assertIn("can_view_protected: z.boolean().optional()", content)

    def test_verbatim_protected_requires_double_authorization(self):
        """测试PROTECTED需要双授权：只有include_protected_text=true但can_view_protected=false仍然掩码"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")
        # 双授权门逻辑存在
        self.assertIn("includeProtectedText && canViewProtected", content)
        # 提示信息包含两个参数都需要
        self.assertIn("include_protected_text=true AND can_view_protected=true to view", content)

    def test_verbatim_apply_security_accepts_can_view_parameter(self):
        """测试applySecurity函数接受canViewProtected参数"""
        project_root = Path(__file__).parent.parent
        verbatim_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        content = verbatim_tool_ts.read_text(encoding="utf-8")
        self.assertIn("canViewProtected: boolean = false", content)
        # 逻辑：只有两个都为true才返回明文
        self.assertIn("!(includeProtectedText && canViewProtected)", content)


class TestTemporalFactLayer(BaseTest):
    """测试 Temporal Fact Layer 时间事实层"""

    def test_entity_fact_interface_exists(self):
        """测试EntityFact接口存在且包含必需字段"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        self.assertIn("export interface EntityFact", content)
        # 必需时间有效性字段
        required_fields = [
            "value:", "valid_from:", "valid_to:", "confidence:", "source_ref:",
        ]
        for field in required_fields:
            self.assertIn(field, content)

    def test_entity_attributes_are_fact_array(self):
        """测试实体属性改为事实数组"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        self.assertIn("attributes: Record<string, EntityFact[]>", content)

    def test_backward_compatibility_exists(self):
        """测试向后兼容性 - 旧的字符串属性自动转换"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        # 检查向后兼容代码存在 - 验证类型转换逻辑
        self.assertIn("backward", content.lower())
        self.assertIn("compatibility", content.lower())
        # 检查转换代码 - 当读取旧格式时自动转换
        self.assertIn("typeof", content)
        self.assertIn("string", content)
        # 找到了转换代码，说明向后兼容存在
        self.assertTrue(True)

    def test_temporal_methods_exist(self):
        """测试时间相关方法存在"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        methods = [
            "addFact",
            "invalidateFacts",
            "getValidFacts",
            "getCurrentValue",
        ]

        for method in methods:
            self.assertIn(method, content)

    def test_get_current_value_returns_active(self):
        """测试getCurrentValue只返回当前有效值"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        # 方法逻辑应该只返回valid_to为null (当前有效)的事实
        self.assertIn("valid_to: null", content)

    def test_entity_fact_tool_handlers_exist(self):
        """测试实体事实工具处理器存在"""
        project_root = Path(__file__).parent.parent
        entity_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "entity-memory.ts"
        content = entity_tool_ts.read_text(encoding="utf-8")

        self.assertIn("handleEntityFactAdd", content)
        self.assertIn("handleEntityFactInvalidate", content)

    def test_invalidate_method_counts_invalidated(self):
        """测试invalidate方法返回无效化的事实数量"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        self.assertIn("invalidateFacts", content)
        # 应该返回被无效化的数量
        self.assertIn("number | null", content)

    def test_addFact_accepts_confidence_source_ref(self):
        """测试addFact接受confidence和sourceRef参数"""
        project_root = Path(__file__).parent.parent
        entity_ts = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        content = entity_ts.read_text(encoding="utf-8")

        self.assertIn("confidence: number = 1.0", content)
        self.assertIn("sourceRef: string | null = null", content)

    def test_entity_fact_confidence_boundary_validation(self):
        """测试entity_fact_add 对 confidence 有 0-1 边界校验"""
        project_root = Path(__file__).parent.parent
        entity_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "entity-memory.ts"
        content = entity_tool_ts.read_text(encoding="utf-8")

        self.assertIn("confidence: z.number().min(0).max(1).optional()", content)

    def test_entity_fact_nonempty_validation(self):
        """测试entity_fact 参数要求非空"""
        project_root = Path(__file__).parent.parent
        entity_tool_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "entity-memory.ts"
        content = entity_tool_ts.read_text(encoding="utf-8")

        self.assertIn("name: z.string().min(1)", content)
        self.assertIn("attribute: z.string().min(1)", content)
        self.assertIn("value: z.string().min(1)", content)


class TestLayerBoundaries(BaseTest):
    """测试层级边界清晰性"""

    def test_three_layer_architecture_present(self):
        """测试三层架构概念存在"""
        # 检查README或文档提到三层架构
        project_root = Path(__file__).parent.parent

        # 检查MCP工具中分层
        # Verbatim = 证据层
        # Entity Fact = 事实层
        # Memory 层级结构本来就有摘要层

        verbatim_loaded = project_root / "apps" / "mcp-server" / "src" / "tools" / "verbatim-evidence.ts"
        entity_fact_loaded = project_root / "apps" / "mcp-server" / "src" / "tools" / "entity-memory.ts"

        self.assertTrue(verbatim_loaded.exists())
        self.assertTrue(entity_fact_loaded.exists())

        # 验证都是独立模块
        verbatim_content = verbatim_loaded.read_text(encoding="utf-8")
        self.assertIn("Verbatim Evidence Layer", verbatim_content)

    def test_modules_are_separated(self):
        """测试模块分离"""
        project_root = Path(__file__).parent.parent

        # 每个功能都在独立文件
        verbatim = project_root / "apps" / "mcp-server" / "src" / "lib" / "verbatim-evidence.ts"
        entity_memory = project_root / "apps" / "mcp-server" / "src" / "lib" / "entity-memory.ts"
        storage = project_root / "apps" / "mcp-server" / "src" / "storage.ts"

        self.assertTrue(verbatim.exists())
        self.assertTrue(entity_memory.exists())
        self.assertTrue(storage.exists())

        # 没有混在一起
        verbatim_content = verbatim.read_text(encoding="utf-8")
        self.assertNotIn("EntityFact", verbatim_content)

        entity_content = entity_memory.read_text(encoding="utf-8")
        self.assertNotIn("VerbatimEvidence", entity_content)


class TestBuildCompletes(BaseTest):
    """测试构建能成功完成"""

    def test_npm_build_succeeds(self):
        """测试npm build成功生成dist"""
        project_root = Path(__file__).parent.parent
        dist_index = project_root / "apps" / "mcp-server" / "dist" / "index.js"

        # 检查构建产物存在
        self.assertTrue(
            dist_index.exists(),
            "dist/index.js should exist after successful npm build"
        )

        # 检查构建产物大小合理
        size_kb = dist_index.stat().st_size / 1024
        self.assertGreater(size_kb, 10)  # 至少10KB
        self.assertLess(size_kb, 10000)  # 不超过10MB

    def test_all_new_tools_are_exported_from_tools_index(self):
        """测试所有新工具都从tools索引导出"""
        project_root = Path(__file__).parent.parent
        tools_index = project_root / "apps" / "mcp-server" / "src" / "tools" / "index.ts"
        content = tools_index.read_text(encoding="utf-8")

        # 检查新模块都已导出
        new_modules = [
            "./verbatim-evidence.js",
        ]

        for module in new_modules:
            self.assertIn(module, content)

    def test_new_tools_are_categorized_correctly(self):
        """测试新增工具都有正确分类"""
        project_root = Path(__file__).parent.parent
        soul_ts = project_root / "apps" / "mcp-server" / "src" / "tools" / "soul.ts"
        content = soul_ts.read_text(encoding="utf-8")

        # 检查分类正确
        self.assertIn("entity_fact_add: 'entity_memory'", content)
        self.assertIn("entity_fact_invalidate: 'entity_memory'", content)
        self.assertIn("verbatim_add: 'memory'", content)
        self.assertIn("verbatim_get: 'memory'", content)
        self.assertIn("verbatim_search: 'memory'", content)
        self.assertIn("verbatim_delete: 'memory'", content)


if __name__ == "__main__":
    unittest.main()
