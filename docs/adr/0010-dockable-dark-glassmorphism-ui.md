# 0010-可吸附暗黑玻璃拟态控制中心 UI / Dockable Dark Glassmorphism Control Center UI

## 状态 / Status

已取代 / Superseded

本 ADR 保留为历史 UI 背景。当前 UI 路径是 Desktop Body-first：桌面身体、气泡、小面板、右键菜单、嵌入式设置和 extension inspector 构成默认体验，不再以 Control Center 为主界面。

## 背景 / Context

历史背景：在 AgentSoul v2 的控制中心（Control Center）实现中，原有布局采用单页纵向堆叠的方式，视觉设计扁平单调，没有充分体现“开发伴侣与控制中心”的高级感与灵活性。该设计后来被 Desktop Body-first 路径取代。

## 决策 / Decision

1. **暗黑玻璃拟态风格 / Dark Glassmorphism Styling**：统一采用暗黑玻璃拟态作为官方唯一的视觉设计系统。底层背景使用深邃渐变（#0b0f19 至 #161d30），卡片与面板使用半透明磨砂玻璃材质（backdrop-filter），配合霓虹发光（Neon Glows）状态指示。
2. **边缘可吸附导航面板 / Dockable Sidebar**：历史方案曾重构控制中心布局为“导航面板 + 激活功能区”。该模式不再作为当前主界面要求；可吸附和玻璃拟态细节可在 Desktop Body 小面板中按需复用。
3. **常驻侧边栏微交互与发光进度条 / Persistent Micro-interactions & Glowing Vitals**：伴侣形象与微交互操作（喂食、玩耍、抚摸、睡觉）常驻于导航面板底部或顶部，方便随时操作。生命体征（Level、XP、Energy、Hunger、Intimacy）均以彩色发光水平进度条展示。
4. **CSS 动态切换与 DOM 兼容 / CSS Display Toggle**：标签页切换不销毁 React 组件或 DOM 树，而是通过 CSS 属性控制激活显示（display/opacity），以最大化保证所有既有契约测试与 DOM 查找测试用例的兼容性。

## 后果 / Consequences

- 旧 Control Center 布局与 Area 导航不再约束当前实现。
- 可复用的视觉资产仅作为 Desktop Body 小面板、extension inspector 或设置面板的设计参考。
- 当前 UI 后果以 Desktop Body 的连续形象表达、气泡、小面板和内联审批为准。
