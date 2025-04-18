#!/data/data/com.termux/files/usr/bin/bash

# Configuration
REPO_URL="https://github.com/CodeNoKami/codenokami-terminal-server.git"
INSTALL_DIR="$HOME/.codenokami-terminal"
PKG_NAME="codenokami-terminal"

echo ">>> Updating and installing required packages..."
apt update && apt install -y make python3 build-essential nodejs git curl

echo ">>> Configuring node-gyp (GYP)..."
mkdir -p ~/.gyp
echo "{'variables': {'android_ndk_path': ''}}" > ~/.gyp/include.gypi

echo ">>> Removing previous installation of $PKG_NAME..."
npm uninstall -g $PKG_NAME
rm -rf $INSTALL_DIR

echo ">>> Cloning repository from GitHub..."
git clone $REPO_URL $INSTALL_DIR

cd $INSTALL_DIR

echo ">>> Installing npm dependencies..."
npm install

echo ">>> Making index.js executable..."
chmod +x index.js

echo ">>> Installing $PKG_NAME globally..."
npm install -g .

echo ">>> Installation complete!"
echo ">>> You can now run the terminal using: run-terminal"
