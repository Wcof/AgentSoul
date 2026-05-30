# 0010-可吸附暗黑玻璃拟态控制中心 UI / Dockable Dark Glassmorphism Control Center UI

## 状态 / Status

已接受 / Accepted

## 背景 / Context

在 AgentSoul v2 的控制中心（Control Center）实现中，原有布局采用单页纵向堆叠的方式，视觉设计扁平单调，没有充分体现“开发伴侣与控制中心”的高级感与灵活性。用户期望优化功能模块划分，改善整体的视觉质感和交互操作链路。

## 决策 / Decision

1. **暗黑玻璃拟态风格 / Dark Glassmorphism Styling**：统一采用暗黑玻璃拟态作为官方唯一的视觉设计系统。底层背景使用深邃渐变（#0b0f19 至 #161d30），卡片与面板使用半透明磨砂玻璃材质（backdrop-filter），配合霓虹发光（Neon Glows）状态指示。
2. **边缘可吸附导航面板 / Dockable Sidebar**：重构控制中心布局为“导航面板 + 激活功能区”。在导航面板角落提供控制纽，点击改变容器的 `data-dock-position`，支持在屏幕四边（left、top、right、bottom）进行布局重排与自适应吸附。
3. **常驻侧边栏微交互与发光进度条 / Persistent Micro-interactions & Glowing Vitals**：伴侣形象与微交互操作（喂食、玩耍、抚摸、睡觉）常驻于导航面板底部或顶部，方便随时操作。生命体征（Level、XP、Energy、Hunger、Intimacy）均以彩色发光水平进度条展示。
4. **CSS 动态切换与 DOM 兼容 / CSS Display Toggle**：标签页切换不销毁 React 组件或 DOM 树，而是通过 CSS 属性控制激活显示（display/opacity），以最大化保证所有既有契约测试与 DOM 查找测试用例的兼容性。

## 后果 / Consequences

- 重排布局可以通过纯 CSS Grid 与 flex 属性结合实现，无需动态修改 React 的 DOM 节点顺序。
- 所有非激活状态下的配置输入框与状态数据仍保留在 DOM 树中，测试组件和 Tauri 抓取脚本仍能顺利读取和交互。
- 视觉与操作品质获得显著提升，符合现代开发者界面的精细审美。
