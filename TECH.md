# DJ-Gao · 技术说明

私人生日声音小冒险：一台粉色 M-VAVE FM-1，一首四版接龙的生日 DJ 歌，支持中英文、手机与电脑。

## 本地预览

```sh
python3 -m http.server 8766 --directory site
```

然后打开 http://localhost:8766/ 。地址加 `?nointro` 可跳过开场。

## 文件

- `site/`：网站。开场在 `intro.js`；生日 DJ set 在 `dj-score.js`（谱与亲手录的目标）、`dj-synth.js`（合成与播放）、`dj-storage.js`（本机保存）、`dj-export.js`（V102 pattern 导出），流程在 `finale.js`；全屏、横屏模式与主屏幕 App 在 `fullscreen.js` 和 `manifest.webmanifest`。
- `tests/`：`node --test tests/*.test.cjs`。
- `tools/`：打包、字体子集、App 图标、键位检查，以及分享视频的重渲染工具 `share-video-blender/`（Blender）。
- `fonts-src/`：完整像素字体。
- `preview/panel-geometry.json`：机器照片上 27 个键的位置。
- `docs/`：固件模拟与 FM-1 真机资料；`docs/images/` 是 README 用的图。

## 构建

改了网页文字后，先重新生成字体子集（需要 `pip install fonttools brotli`），再打包：

```sh
python3 tools/subset_fonts.py
python3 tools/package_site.py
```

`package_site.py` 生成 `exports/` 下的离线单文件 HTML 和网站压缩包。`exports/` 不进 git。

## 分享视频

分享视频是三个固定的预渲染文件，放在 `site/assets/share/`：完整版 `happy-birthday.mp4`（Blender 版夜店现场，困难模式的固定生日歌，1080×1920、30 fps、87.3 秒、3.5 Mbps，约 40 MB），以及快拍用的两半 `happy-birthday-story-1.mp4` / `happy-birthday-story-2.mp4`（在 43.66 秒处平分，各约 21 MB）。三个 mp4 都不进 git：本地放在这个路径，部署时从 GitHub Release 取（Release 里放这三个文件）。封面帧 `happy-birthday-poster.webp`（540×960）进 git。网站在她进入第四版时后台下载完整版；生日卡上的「看你的生日现场」全屏播放（`site/premiere.js`），播完后分享：Reels 用完整版，快拍只在选它时才下载两半。重新渲染见 `tools/share-video-blender/README.md`（编码时用 3.5 Mbps，在 43.66 秒强制关键帧再切两半）。

## 部署到 GitHub Pages

`.github/workflows/pages.yml` 在每次推送 `main` 时把 `site/` 发布到 GitHub Pages。三个分享视频不进 git，部署时从名为 `media` 的 Release 取，放进 `site/assets/share/`，所以网站和视频同源。没有这个 Release 时照常部署，分享按钮自己隐藏。

第一次：

1. 在 GitHub 建公开仓库，推送 `main`。
2. 仓库 Settings → Pages → Source 选「GitHub Actions」。
3. 建 Release 并上传三个视频：

   ```sh
   gh release create media site/assets/share/happy-birthday.mp4 site/assets/share/happy-birthday-story-1.mp4 site/assets/share/happy-birthday-story-2.mp4 --title "Share videos" --notes "Videos for the birthday show and Instagram sharing."
   ```

4. 在 Actions 里重新运行「Deploy to GitHub Pages」。

换视频：`gh release upload media <文件> --clobber`，再重新运行部署。

## 固件与真机

「固件」模式用 `fm1-emu` 在浏览器里运行用户自己选择的 `.fwsc`，说明见 `docs/fm1-emulation.md`。生日卡的「在 FM-1 上弹 →」导出 Baud Girl V102 的 pattern（`.syx`），资料见 `docs/birthday-hardware-research.md`，真机验证状态见 `docs/fm1-v102-dj-verification.md`。

作品保存在浏览器 `localStorage`（键名 `fm1-dj-birthday-v1`），不会离开这台设备。
