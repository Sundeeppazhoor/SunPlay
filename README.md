# SunPlay

Pure native C/C++ media player and streaming application for **LG webOS TV**, engineered for zero-copy hardware video decoding, dual video plane acceleration, and low-memory performance on 4K HDR Remux streams.

---

## 🏆 Credits & Acknowledgments

The core native media engine and playback architecture of **SunPlay** are proudly built upon and adapted from the open-source media player project [nuvio-native-legacy](https://github.com/iqui27/nuvio-native-legacy) by **iqui27**.

We express our sincere appreciation and credit to:
- **iqui27** ([@iqui27](https://github.com/iqui27)) for architecting `nuvio-native-legacy` and pioneering native webOS uMS & libAcbAPI media plane integration.
- The open-source LG webOS homebrew and development community.

All original underlying player routines, video subsystem integrations, and native Luna Service bus bindings remain the intellectual property and creation of their respective authors under their original open-source licenses.

---

## Highlights & Features

1. **Pure Native Architecture (No HTML5 / Chromium overhead)**:
   - Written in C99 with SDL2 and OpenGL ES 2.0.
   - Communicates directly with the LG webOS native media server (`luna://com.webos.media` / `uMS`) via `libluna-service2`.
   - Dual video plane support:
     - **webOS 4.x** (e.g. OLED C9, B9): Hardware plane integration via `libAcbAPI`.
     - **webOS 5.0+** (CX, C1, C2, C3, C4, G-series): Hardware plane integration via `SDL_webOSCreateExportedWindow`.
   - Native hardware decoding for **4K Ultra HD, 1080p, HEVC (H.265), H.264, VP9, AV1, HDR10, and Dolby Vision**.

2. **Audio Track Selection**:
   - Real-time detection of multiple audio tracks embedded in the stream (`sourceInfo`).
   - Seamless switching between language tracks without restarting playback.
   - Audio passthrough support for Dolby Atmos, Dolby Digital Plus (EAC3), AC3, and DTS.

3. **Subtitles & OpenSubtitles Integration**:
   - **Embedded Subtitles**: Detects and plays embedded text tracks from MKV, MP4, and TS streams.
   - **OpenSubtitles v3 Integration**: Asynchronously searches OpenSubtitles v3 for subtitles matching the title / IMDb ID, downloads remote SRT/WebVTT cues, and parses them on a background thread.
   - **High-Precision Overlay**: Subtitles rendered as sharp, high-contrast text on top of the hardware video plane.
   - **Customizable Styling & Timing**:
     - Size: Small, Normal, Large, Extra Large
     - Colors: White, Yellow, Green, Blue, Red, Black
     - Background: None, Translucent, Solid
     - Position: Vertical offset adjustment
     - Delay / Sync (`Atraso`): Adjust timing in milliseconds to fix out-of-sync audio/subtitles.

4. **Player Controls & Navigation**:
   - Auto-hiding modern player HUD (4-second inactivity timer).
   - Fast-forward & Rewind with hold-to-accelerate jumps (10s, 30s, 60s, 120s).
   - Smooth progress bar with scrub buffer preview.
   - Aspect ratio mode switcher: Original, 16:9, Zoom, Letterbox.
   - Video info / health stream diagnostics (resolution, frame rate, bitrate, codec, HDR status).
   - Full LG Magic Remote & D-pad navigation with Back button support.

---

## Project Structure

```
SunPlay/
├── app/
│   ├── appinfo.json             # App metadata (id: com.sunplay.native, type: native)
│   ├── icon.png                 # App icon
│   ├── icon-large.png           # App large icon
│   ├── sunplay-native           # Compiled ARMv7 native ELF binary
│   ├── art/                     # UI icons, badges, visual assets
│   └── fonts/                   # Inter TrueType fonts
├── src/                         # Full C Source Code (142 files)
│   ├── main.c                   # Application lifecycle, SDL2 window, GL setup
│   ├── video.c                  # webOS Luna Bus, uMS, libAcbAPI media pipeline
│   ├── video.h                  # Media pipeline declarations & stream info
│   ├── player.c                 # Player UI overlay, progress bar, OSD
│   ├── player.h                 # Player UI functions
│   ├── faixas.c / faixas.h      # Audio & Subtitle track selector sheets
│   ├── legenda.c / legenda.h    # Subtitle parser (SRT/VTT) & cue sync
│   ├── addons.c / addons.h      # OpenSubtitles v3 API integration
│   ├── mkv.c / mkv.h            # Matroska container parser
│   ├── gfx.c / gfx.h            # OpenGL ES 2.0 renderer
│   ├── text.c / text.h          # SDL_ttf font rendering engine
│   └── ...                      # Catalog, search, settings, networking
├── tools/
│   ├── Dockerfile               # ARM cross-compilation container (openlgtv/buildroot-nc4)
│   ├── arm.sh                   # Build script for ARM target
│   └── env.sh                   # Environment variables
├── Makefile                     # Build & deployment targets
├── package.bat                  # 1-click Windows IPK packager
└── dist/
    └── com.sunplay.native_1.0.0_arm.ipk  # Ready-to-install package
```

---

## Packaging the App (Windows)

To build the ready-to-install `.ipk` package on Windows:

1. Double-click `package.bat` (or run it from the terminal):
   ```cmd
   cd "SunPlay - Native"
   package.bat
   ```
2. The output IPK will be generated in `dist/com.sunplay.native_1.0.0_arm.ipk`.

---

## Installing on LG TV

### Method 1: Using LG webOS CLI (`ares-install`)
```cmd
ares-install dist\com.sunplay.native_1.0.0_arm.ipk -d <TV_DEVICE_NAME>
ares-launch com.sunplay.native -d <TV_DEVICE_NAME>
```

### Method 2: webOS Homebrew Channel
1. Copy `com.sunplay.native_1.0.0_arm.ipk` to a USB flash drive or send via IPK installer.
2. Open Homebrew Channel on your TV and install the package.
