#!/data/data/com.termux/files/usr/bin/bash

echo "[*] Installing CodeNoKami Terminal Server..."

SERVER_DIR="$HOME/.codenokami-terminal"
BIN_PATH="$PREFIX/bin/run-terminal"

# Create hidden folder if it doesn't exist
if [ ! -d "$SERVER_DIR" ]; then
  echo "[+] Creating server folder at $SERVER_DIR"
  mkdir -p "$SERVER_DIR"
else
  echo "[i] Server folder already exists."
fi

# Change to the server folder
cd "$SERVER_DIR" || exit

# Clone the server repo
echo "[*] Cloning terminal server..."
git clone https://github.com/YOUR_USERNAME/YOUR_SERVER_REPO.git .

# Install dependencies
echo "[*] Installing Node.js..."
pkg install nodejs -y
npm install

# Add global run-terminal command
echo "[*] Setting up 'run-terminal' command..."
if [ -f "$BIN_PATH" ]; then
  rm "$BIN_PATH"
fi

# Create a symlink to index.js
echo -e "#!/data/data/com.termux/files/usr/bin/bash\nnode $SERVER_DIR/index.js --run-terminal" > "$BIN_PATH"
chmod +x "$BIN_PATH"

echo "[✓] Installation complete!"
echo "Now you can run the terminal server with:"
echo "  run-terminal"