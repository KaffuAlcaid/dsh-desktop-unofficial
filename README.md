绝赞施工中

## Linux 显示后端

Linux 发行包在 Wayland 会话中默认通过 XWayland 运行，以规避部分 NVIDIA 驱动在原生 Wayland 下的 GPU 进程崩溃。首个发行版要求系统提供 XWayland。

原生 Wayland 暂为实验模式，可在启动时显式传入 `--ozone-platform=wayland` 覆盖默认行为。部分 NVIDIA 驱动可能因此反复产生 GPU 进程崩溃记录。
