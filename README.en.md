# Shui - Water Reminder Assistant

<p align="center">
  <img src="public/screenshot-0.png" alt="Shui Screenshot" width="350"/>
  <br/>
</p>

A cross-platform desktop app focused on water intake reminders, promoting office workers' health 💪 and improving your drinking habits.

## ✨ Key Features

- 🎯 Daily Water Intake Goals
- 🖥️ Full-screen Reminders - Elegant and Unmissable Break Notifications
- ⏰ Smart Time Management
  - Customizable Reminder Intervals
  - Smart Workday Reminders
  - Custom Time Range
- 🔔 Diverse Notification Methods
  - Full-screen Notification Page
  - Native System Notifications
  - Tray Real-time Countdown
  - Goal Completion Sound Effects
- 💡 Smart and User-friendly
  - Automatic Workday Recognition
  - Auto-pause on Screen Lock/Sleep
  - Tray Quick Actions
  - App Whitelist (Default: Tencent Meeting, Zoom, Google Meet, Microsoft Teams)
- 📊 Data Statistics
  - Daily Water Intake Statistics
  - Drinking Habit Analysis
  - Break Reminder Statistics
  - Data Visualization

## 🖥 Application Interface

<p align="center">
  <img src="public/screenshot-2.png" alt="Settings"/>
  <br/>
  <img src="public/screenshot-3.png" alt="Notification"/>
</p>

## 🚀 Getting Started

### Platform Support

- ✅ macOS
- ✅ Windows
- 🚧 Linux (coming soon)
- 🚧 Android (coming soon)

### Download and Installation

Download the latest version from the [Releases](https://github.com/rock-zhang/Shui/releases/) page.

#### macOS

- Apple Silicon: Download `Shui_x.x.x_aarch64.dmg`
- Intel Chip: Download `Shui_x.x.x_x64.dmg`

#### Windows

- 64-bit System: Download `Shui_x.x.x_x64-setup.exe`
- 32-bit System: Download `Shui_x.x.x_x86-setup.exe`
- ARM64 Architecture: Download `Shui_x.x.x_arm64-setup.exe`

#### Note

<img src="public/install_error.png" />

If you encounter the "Shui is damaged and can't be opened" message on `macOS`, please run the following command in Terminal:

```shell
sudo xattr -r -d com.apple.quarantine /Applications/Shui.app
```

## 🛣 Development Roadmap

### Implemented Features

- [x] Basic Reminder Functionality
- [x] Customizable Reminder Intervals
- [x] Smart Workday Reminders
- [x] System Tray Support
- [x] Global Hotkeys
- [x] App Whitelist Management
- [x] Auto-pause on Screen Lock/Sleep
- [x] Tray Quick Actions
- [x] Custom Time Range
- [x] Native System Notifications
- [x] Tray Real-time Countdown

### Development Plans

- [x] Windows Support
- [ ] Multi-language Support
- [ ] Linux Support
- [x] Reminder Sound Effects
- [x] Data Statistics and Analysis
  - [x] Water Intake Trend Charts
  - [x] Break Reminder Statistics (display duration, not actual rest time)
  - [x] Data Export Functionality
  - [x] Water Intake Time Distribution
  - [x] Water Intake Interval Analysis
- [x] Custom Themes

### Drinking time analysis

The Statistics page shows four local-time buckets (00–06, 06–12, 12–18 and 18–24) and the mean, median, shortest and longest intervals for the selected 7 or 30 days. Only adjacent events on the same local date are compared. Equal timestamps do not create intervals; positive intervals under one minute are retained.

Only valid timestamped entries contribute to this analysis. Legacy daily totals remain available in the trend chart. Times are interpreted in the device's current time zone, and unrecorded drinks cannot be included.

After installing dependencies, run `node --test tests/drink-patterns.test.cjs` to verify the calculations.

Break reminder statistics summarize completed full-screen reminders, including manual tray reminders, over the selected 7/30 days. Outcomes include confirmed drinks, skips/Esc and timeouts. Multiple monitors share one session, assigned to its starting date, with display time capped at 30 seconds. Native notifications and sessions interrupted by an app crash are excluded. Use Refresh to load new records. Statistics are stored separately in `reminder_history_store.json`; CSV export still contains drinking records only.

## 🛠 Tech Stack

- [Tauri](https://tauri.app/) - Cross-platform Desktop App Framework
- [Next.js](https://nextjs.org/) - React Application Framework
- [React](https://reactjs.org/) - User Interface Framework
- [Rust](https://www.rust-lang.org/) - Backend Logic Implementation
- [shadcn/ui](https://ui.shadcn.com/) - UI Component Library

## Community

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/qrcode_wechat_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="public/qrcode_wechat_light.png" />
  <img width="300px" src="public/qrcode_wechat_light.png" />
</picture>

## ☕ Support

If you find this project helpful, please give the author a free Star. Thank you for your support!

## Star History

<a href="https://www.star-history.com/#rock-zhang/Shui&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rock-zhang/Shui&type=Date" />
 </picture>
</a>
