# L2: Local File Mode 启动协议

## 本地文件读取

1. 读取 `config/persona.yaml` → 加载人格配置
2. 读取 `config/behavior.yaml` → 加载行为配置
3. 按需读取规则文件
4. 按当前任务读取记忆文件

## 持久化规则

- 直接写入规定路径
- 写入后说明文件路径
- 健康检查需要能验证
