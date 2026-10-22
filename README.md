# Shui - 喝水提醒助手

<p align="center">
  <img src="public/screenshot-0.png" alt="Shui Screenshot" width="350"/>
  <br/>
</p>

一个专注喝水提醒的跨端桌面 App，关注打工人健康 💪 ，改善你的喝水习惯。

## ✨ 主要特性

- 🎯 每日饮水目标设定
- 🖥️ 全屏提醒 - 优雅且不可忽视的休息提示
- ⏰ 智能时间管理
  - 自定义提醒间隔
  - 工作日智能提醒
  - 自定义时间范围
- 🔔 多样化提醒方式
  - 全屏通知页面
  - 系统原生通知
  - 托盘实时倒计时
  - 目标完成音效提醒
- 💡 智能且人性化
  - 自动识别工作日
  - 息屏、锁屏自动暂停
  - 托盘快捷操作
  - 应用白名单（默认：腾讯会议, Zoom, Google Meet, Microsoft Teams）
- 📊 数据统计
  - 每日饮水量统计
  - 饮水习惯分析
  - 休息提醒统计
  - 数据可视化展示

## 🖥 应用界面

<p align="center">
  <img src="public/screenshot-2.png" alt="Settings"/>
  <br/>
  <img src="public/screenshot-3.png" alt="Notification"/>
</p>

## 🚀 开始使用

### Platform Support

- ✅ macOS
- ✅ Windows
- ✅ Linux
- 🚧 Android (coming soon)

### 下载安装

从 [Releases](https://github.com/rock-zhang/Shui/releases/) 页面下载最新版本。

#### macOS

- Apple Silicon：下载 `Shui_x.x.x_aarch64.dmg`
- Intel Chip：下载 `Shui_x.x.x_x64.dmg`

#### Windows

- 64 位系统：下载 `Shui_x.x.x_x64-setup.exe`
- 32 位系统：下载 `Shui_x.x.x_x86-setup.exe`
- ARM64 架构：下载 `Shui_x.x.x_arm64-setup.exe`

#### Linux

- x86_64 架构：下载 `Shui_x.x.x_amd64.deb`
- ARM64 架构：下载 `Shui_x.x.x_arm64.deb`

#### 注意

<img src="public/install_error.png" />

`macOS`下如果遇到`"Shui"已损坏，无法打开`的提示，请在终端运行

```shell
sudo xattr -r -d com.apple.quarantine /Applications/Shui.app
```

## 🛣 开发路线

### 已实现功能

- [x] 基础提醒功能
- [x] 自定义提醒间隔
- [x] 工作日智能提醒
- [x] 系统托盘支持
- [x] 全局快捷键
- [x] 应用白名单管理
- [x] 息屏、锁屏自动暂停
- [x] 托盘快捷操作
- [x] 自定义时间范围
- [x] 系统原生通知
- [x] 托盘实时倒计时

### 开发计划

- [x] Windows 适配
- [x] Linux 适配
- [x] 提醒音效
- [ ] 多语言支持
- [x] 数据统计与分析
  - [x] 饮水量趋势图表
  - [x] 休息提醒统计（展示时长，不代表实际休息时长）
  - [x] 数据导出功能
  - [x] 饮水时间分布
  - [x] 饮水时间间隔分析
- [x] 自定义主题

### 饮水时间分析

「统计」页提供所选 7/30 天的按日饮水明细，可展开查看时间与水量。带唯一请求标识的新记录支持二次确认后撤销；仅有总量或没有标识的旧记录仅可查看。撤销保留历史目标和请求去重标识，重复撤销不重复扣减，原请求重试也不会重新添加；保存失败可安全重试。撤销后刷新趋势、时间分析和 CSV 数据，不改变提醒次数。

普通分支推送与 PR 会触发 `.github/workflows/ci.yaml`：前端测试、ESLint、生产构建，以及 macOS 上的 Rust 全量测试。该流程不发布应用，也不替代真实多屏和跨平台桌面验证。

「统计」页支持手动记录 50/100/200/300ml，系统通知模式下也可使用。保存成功后自动刷新；保存失败可重试同一笔请求。提醒页与手动入口共用 Rust 串行写入接口，日期、时间和目标均由后端读取，旧版数字总量会在下一次记录时兼容升级。

每笔记录持久保存请求标识，同一笔重试只累加一次；多屏全屏提醒共用会话标识，只接受第一次成功保存的水量。手动添加是独立饮水记录，不增加休息提醒次数。新记录可继续用于趋势、时间分析和 CSV 导出。

在「统计」中选择近 7 天或 30 天，可查看凌晨（00–06）、上午（06–12）、下午（12–18）、晚间（18–24）的饮水量与次数，以及同一天内相邻记录的平均、中位、最短和最长间隔。时间按当前设备的本地时区解释，不计算跨日或相同时间戳之间的间隔；不足一分钟的有效间隔会保留。

分析只包含有有效时间信息的单次记录，旧版每日总量仍用于趋势图，不会补造饮水时间。未记录的饮水无法纳入分析，因此这些结果描述的是记录习惯。

开发验证：安装依赖后运行 `node --test tests/drink-patterns.test.cjs`。

「休息提醒统计」按所选 7/30 天汇总已结束的全屏提醒（含托盘“立即休息”），记录确认饮水、跳过/Esc、自动关闭次数及累计展示秒数。多屏共享一次提醒，按开始日期归档，单次时长最多 30 秒。系统通知和异常退出的未结束提醒不计入；历史数据不补造，可点击「刷新」读取新记录。统计独立保存在 `reminder_history_store.json`，CSV 导出仍仅包含饮水记录。

回归检查：`node --test tests/*.test.cjs`、`corepack yarn build`、`cargo test --workspace`。

## 🛠 技术栈

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Next.js](https://nextjs.org/) - React 应用框架
- [React](https://reactjs.org/) - 用户界面框架
- [Rust](https://www.rust-lang.org/) - 后端逻辑实现
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库

## 社区交流

欢迎 PR 和 Issue，一起探讨和改进 Shui！
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/rock-zhang/Shui)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/qrcode_wechat_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="public/qrcode_wechat_light.png" />
  <img width="300px" src="public/qrcode_wechat_light.png" />
</picture>

## ☕ 支持

如果你觉得本项目帮助到了你，请给作者一个免费的 Star，感谢你的支持！

## Star History

<a href="https://www.star-history.com/#rock-zhang/Shui&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date" />
 </picture>
</a>
