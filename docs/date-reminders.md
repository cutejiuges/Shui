# 日期提醒

对应上游 [Issue #33](https://github.com/rock-zhang/Shui/issues/33)。

## 使用方式

在“提醒 → 日期提醒”中选择日期和安排，点击“添加日期”：

- **补班日**：当天安排提醒，即使该星期未被选中。
- **休假日**：当天不定时提醒，即使该星期已被选中。

每个日期只能有一条规则，支持修改日期、切换安排和删除。删除后恢复按星期判断；取消编辑不会改变已保存的规则。指定日期采用系统本地日期，仅在当天生效，重启后保留。

页面展示今日是否安排提醒及原因；后台计时器和托盘使用同一判断。补班日仍遵循提醒时段、每日目标、锁屏暂停和应用白名单。手动“立即休息”仍可使用。

全部配置保存在本地，无需联网。旧配置继续按星期提醒。当前不自动导入法定节假日，也不自动生成大小周排期。

## 验证

```sh
node --test tests/*.test.cjs
corepack yarn eslint -c src/eslint.config.mjs src
corepack yarn build
cargo test --workspace --locked
python3 tests/native/startup_smoke.py --build --artifacts artifacts/native-smoke
```

Linux 原生测试在 X11 会话运行，CI 使用 `dbus-run-session`、Xvfb 和 Openbox。三平台 CI 均执行默认应用构建、Rust 测试和原生冒烟测试。

回归覆盖星期规则兼容、补班和休假优先级、日期增删改、重复及无效日期、闰日与跨日边界、时段和目标限制。原生测试在隔离配置的真实 WebView 中操作日期表单，验证保存、取消、错误提示、后台提醒抑制与触发，以及冷启动后的规则恢复。
