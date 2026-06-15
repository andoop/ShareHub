---
description: 终止手机同步并停止 runtime server
---

终止 Sandtable 手机同步。

执行：
1. 运行 `scripts/sandtable-mobile-stop.sh`。
2. 确认 `GET /health` 不可用或 `mobile-sync/status` 显示 inactive。
3. 告知用户手机 App 将显示 Reconnecting/Disconnected；需重新 `/sandtable-mobile-start` 才能再同步。
4. 若有活跃 feature，在 `journal.md` 追加 stop 记录。
