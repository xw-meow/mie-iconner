#!/bin/bash
# 打包 小羊贴纸铺.app:
#   1. swift build 出 universal(arm64 + x86_64)release 二进制
#   2. 组装 .app bundle(资源包放 Contents/Resources,codesign 才认)
#   3. ad-hoc 签名(无开发者证书,用户首次打开需右键→打开)
#   4. 出 DMG(带 Applications 软链,拖拽安装,供 GitHub Release 分发)
#
# 用法: scripts/package-app.sh [输出目录,默认 dist]
set -euo pipefail

APP_NAME="小羊贴纸铺"
BINARY_NAME="mie-iconner"
RESOURCE_BUNDLE="mie-iconner_mie-iconner.bundle"
ICON_NAME="AppIcon"
OUT_DIR="${1:-dist}"

cd "$(dirname "$0")/.."

echo "==> swift build -c release (arm64 + x86_64)"
swift build -c release --arch arm64 --arch x86_64

PRODUCTS_DIR=".build/apple/Products/Release"
BINARY="$PRODUCTS_DIR/$BINARY_NAME"
RESOURCES="$PRODUCTS_DIR/$RESOURCE_BUNDLE"
[[ -f "$BINARY" ]] || { echo "找不到二进制: $BINARY" >&2; exit 1; }
[[ -d "$RESOURCES" ]] || { echo "找不到资源包: $RESOURCES" >&2; exit 1; }

# 从 Sources/icon.png 生成全尺寸 iconset → icns
# (sips 逐档缩放,iconutil 合成;源图 1254×1254,覆盖 16~1024)
echo "==> 生成 $ICON_NAME.icns"
ICONSET="$OUT_DIR/AppIcon.iconset"
ICNS="$OUT_DIR/$ICON_NAME.icns"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
for spec in "16 1" "32 2" "32 1" "64 2" "128 1" "256 2" "256 1" "512 2" "512 1" "1024 2"; do
    read -r size scale <<< "$spec"
    suffix=$([ "$scale" = "2" ] && echo "@2x" || echo "")
    sips -z "$size" "$size" "Sources/icon.png" \
        --out "$ICONSET/icon_${size}x${size}${suffix}.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"

APP_DIR="$OUT_DIR/$APP_NAME.app"
echo "==> 组装 $APP_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$BINARY" "$APP_DIR/Contents/MacOS/$BINARY_NAME"
cp "Sources/mie-iconner/Info.plist" "$APP_DIR/Contents/Info.plist"
# 资源包放标准 Resources 目录;放 .app 根会被 codesign
# 视为 unsealed contents 而签名失败(查找逻辑见 ContentView.bundledIconsURL)
cp -R "$RESOURCES" "$APP_DIR/Contents/Resources/$RESOURCE_BUNDLE"
cp "$ICNS" "$APP_DIR/Contents/Resources/$ICON_NAME.icns"

echo "==> ad-hoc 签名"
codesign --force --sign - "$APP_DIR/Contents/Resources/$RESOURCE_BUNDLE"
codesign --force --sign - "$APP_DIR"

echo "==> 生成 DMG(带卷标图标)"
mkdir -p "$OUT_DIR"
DMG="$OUT_DIR/$APP_NAME-macOS.dmg"
RW_DMG="$OUT_DIR/rw-$APP_NAME.dmg"
STAGING="$OUT_DIR/dmg-staging"
rm -f "$DMG" "$RW_DMG"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP_DIR" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
# 压缩格式不支持写卷标图标:先出读写镜像,挂载、
# 贴图标、卸载,再转成 UDZO 压缩镜像
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" \
    -ov -format UDRW "$RW_DMG" >/dev/null
rm -rf "$STAGING"
# 用 -mountroot 固定挂载位置,避免卷名冲突时
# 挂载点带 " 1" 后缀导致路径解析出错
MOUNT_ROOT="$OUT_DIR/dmg-mnt"
rm -rf "$MOUNT_ROOT"
mkdir -p "$MOUNT_ROOT"
hdiutil attach "$RW_DMG" -nobrowse -mountroot "$MOUNT_ROOT" >/dev/null
MOUNT_DIR="$MOUNT_ROOT/$APP_NAME"
cp "$ICNS" "$MOUNT_DIR/.VolumeIcon.icns"
SetFile -a C "$MOUNT_DIR"
hdiutil detach "$MOUNT_DIR" -quiet
rm -rf "$MOUNT_ROOT"
hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -ov -o "$DMG" >/dev/null
rm -f "$RW_DMG" "$ICNS"

echo "==> 完成: $DMG"
