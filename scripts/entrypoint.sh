#!/bin/bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
SCREEN="${SCREEN:-1280x900x24}"
export DISPLAY=:99

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR/profile" "$DATA_DIR/claude" "$DATA_DIR/work" /tmp/.X11-unix
  chmod 1777 /tmp/.X11-unix
  chown -R pwuser:pwuser "$DATA_DIR"
  exec setpriv --reuid=pwuser --regid=pwuser --init-groups env HOME=/home/pwuser "$0" "$@"
fi

export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$DATA_DIR/claude}"

Xvfb :99 -screen 0 "$SCREEN" -nolisten tcp -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
for i in $(seq 1 50); do [ -S /tmp/.X11-unix/X99 ] && break; sleep 0.1; done

x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 -noxdamage -quiet >/tmp/x11vnc.log 2>&1 &
websockify --web /usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900 >/tmp/websockify.log 2>&1 &

cd /app
exec node src/server.js
