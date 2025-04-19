#!/data/data/com.termux/files/usr/bin/bash

# Configuration
REPO_URL="https://github.com/CodeNoKami/codenokami-terminal-server.git"
INSTALL_DIR="$HOME/.codenokami-terminal"
PKG_NAME="codenokami-terminal"

echo ">>> [1/6] Updating Termux & installing required packages..."
apt update -y && apt install -y make python3 build-essential nodejs git curl

echo ">>> [2/6] Configuring node-gyp (for node-pty support)..."
mkdir -p ~/.gyp
echo "{'variables': {'android_ndk_path': ''}}" > ~/.gyp/include.gypi

echo ">>> [3/6] Removing previous global install of $PKG_NAME (if exists)..."
npm uninstall -g $PKG_NAME >/dev/null 2>&1

echo ">>> [4/6] Cleaning previous install directory..."
rm -rf "$INSTALL_DIR"

echo ">>> [5/6] Cloning from GitHub..."
git clone "$REPO_URL" "$INSTALL_DIR"

cd "$INSTALL_DIR" || {
  echo ">>> [Error] Failed to access install directory!"
  exit 1
}

echo ">>> [6/6] Installing npm dependencies and registering CLI..."
chmod +x index.js
npm install
npm install -g .

echo ""
echo ">>> [✓] Installation complete!"
echo ">>> You can now run the terminal server using: run-terminal"
