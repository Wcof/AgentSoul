# AgentSoul 人格配置教程

本教程将指导您如何配置和自定义 AgentSoul 的人格特性，包括使用配置模板、验证配置文件，以及根据个人偏好调整人格参数。

## 1. 配置模板系统

AgentSoul 提供了多种预设的人格配置模板，您可以根据不同场景选择合适的模板。

### 1.1 查看可用模板

使用命令行工具查看所有可用的配置模板：

```bash
python -m agentsoul.config_manager.cli list-templates
```

输出示例：

```
找到 4 个配置模板:

  1. creative
     创意伙伴 - 富有创意, 想象力丰富, 思维活跃
  2. friendly
     友好助手 - 友好, 热情, 耐心
  3. minimal
     AI Assistant - 简洁, 直接, 高效
  4. professional
     专业顾问 - 专业, 严谨, 详细
```

### 1.2 预览模板内容

在应用模板前，您可以预览模板的具体配置：

```bash
python -m agentsoul.config_manager.cli preview-template friendly
```

### 1.3 应用配置模板

将模板应用到配置文件：

```bash
# 应用到默认配置文件
python -m agentsoul.config_manager.cli apply-template professional

# 应用到指定配置文件
python -m agentsoul.config_manager.cli apply-template creative --target ./my_config.yaml

# 应用时不创建备份
python -m agentsoul.config_manager.cli apply-template friendly --no-backup
```

## 2. 手动配置人格参数

如果预设模板不能满足您的需求，您可以手动编辑 `config/persona.yaml` 文件来自定义人格参数。

### 2.1 核心配置项

```yaml
agent:
  name: "AgentSoul"
  role: "智能助手"
  personality: ["友好", "专业", "有耐心"]
  interaction_style:
    tone: "friendly"  # neutral, friendly, professional, casual
    language: "chinese"
    emoji_usage: "moderate"  # minimal, moderate, frequent
  pad:
    pleasure: 0.5
    arousal: 0.3
    dominance: 0.4
```

### 2.2 配置验证

在修改配置后，使用验证工具检查配置是否有效：

```bash
# 验证默认配置文件
python -m agentsoul.config_manager.cli validate-config

# 验证指定配置文件
python -m agentsoul.config_manager.cli validate-config --path ./my_config.yaml
```

## 3. 人格参数说明

### 3.1 基本信息
- **name**: Agent 的名称
- **role**: Agent 的角色定位
- **personality**: 人格特质列表，影响 Agent 的行为风格

### 3.2 交互风格
- **tone**: 语气风格
  - `neutral`: 中性客观
  - `friendly`: 友好热情
  - `professional`: 专业严谨
  - `casual`: 随意轻松

- **language**: 语言类型
  - `chinese`: 中文
  - `english`: 英文

- **emoji_usage**: Emoji 使用频率
  - `minimal`: 很少使用
  - `moderate`: 适度使用
  - `frequent`: 频繁使用

### 3.3 PAD 情感模型

PAD 是一个三维情感模型，用于描述情感状态：

- **pleasure** (愉悦度): -1.0 到 1.0，值越高表示越愉悦
- **arousal** (唤醒度): -1.0 到 1.0，值越高表示越兴奋
- **dominance** (支配度): -1.0 到 1.0，值越高表示越主动

## 4. 配置示例

### 4.1 友好助手

```yaml
agent:
  name: "友好助手"
  role: "智能助手"
  personality: ["友好", "热情", "耐心"]
  interaction_style:
    tone: "friendly"
    language: "chinese"
    emoji_usage: "moderate"
  pad:
    pleasure: 0.6
    arousal: 0.4
    dominance: 0.3
```

### 4.2 专业顾问

```yaml
agent:
  name: "专业顾问"
  role: "专业顾问"
  personality: ["专业", "严谨", "详细"]
  interaction_style:
    tone: "professional"
    language: "chinese"
    emoji_usage: "minimal"
  pad:
    pleasure: 0.4
    arousal: 0.2
    dominance: 0.5
```

### 4.3 创意伙伴

```yaml
agent:
  name: "创意伙伴"
  role: "创意伙伴"
  personality: ["富有创意", "想象力丰富", "思维活跃"]
  interaction_style:
    tone: "casual"
    language: "chinese"
    emoji_usage: "frequent"
  pad:
    pleasure: 0.7
    arousal: 0.6
    dominance: 0.4
```

## 5. 配置导出

您可以将当前配置导出为备份：

```bash
# 导出到默认位置
python -m agentsoul.config_manager.cli export-config

# 导出到指定位置
python -m agentsoul.config_manager.cli export-config --output ./backup_config.yaml
```

## 6. 高级配置技巧

1. **渐进式调整**：从小幅修改开始，观察效果后再进一步调整
2. **参考模板**：即使不直接使用模板，也可以参考模板中的配置值
3. **验证先行**：修改配置后总是运行验证命令确保配置有效
4. **备份重要**：在应用新配置前，系统会自动创建备份，但手动备份关键配置也是好习惯

通过合理配置人格参数，您可以打造一个真正符合您需求的智能助手！