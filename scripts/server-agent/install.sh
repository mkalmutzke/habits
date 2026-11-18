#!/bin/sh
# Installs the Habits server health agent (v3.8) on a Linux server with
# systemd. Run as root, with the server-ingest address shown in the app:
#   sudo sh install.sh https://<project>.supabase.co/functions/v1/server-ingest
# It asks for this server's token (shown once in the app) without showing
# it, so it never ends up in the shell history. What it does:
#   /usr/local/bin/habits-agent          the agent (habits-agent.sh, from the same place as this script)
#   /etc/habits-agent.conf               address, token, watched services (root-only)
#   habits-agent.service + .timer        runs the agent every 5 minutes
# Remove it again: sudo sh install.sh --remove
set -eu

AGENT_SOURCE=${HABITS_AGENT_SOURCE:-https://raw.githubusercontent.com/mkalmutzke/habits/main/scripts/server-agent/habits-agent.sh}
CONF=/etc/habits-agent.conf
UNIT_DIR=/etc/systemd/system

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (sudo sh install.sh …)." >&2
  exit 1
fi

if [ "${1:-}" = "--remove" ]; then
  systemctl disable --now habits-agent.timer 2>/dev/null || true
  rm -f "$UNIT_DIR/habits-agent.service" "$UNIT_DIR/habits-agent.timer" /usr/local/bin/habits-agent "$CONF"
  rm -rf /var/cache/habits-agent
  systemctl daemon-reload
  echo "Habits agent removed."
  exit 0
fi

url=${1:-}
case "$url" in
  https://*/functions/v1/server-ingest) ;;
  *)
    echo "Usage: sudo sh install.sh https://<project>.supabase.co/functions/v1/server-ingest" >&2
    exit 1
    ;;
esac

printf 'Server token from the app (not shown while you paste it): '
stty -echo < /dev/tty 2>/dev/null || true
read -r token < /dev/tty
stty echo < /dev/tty 2>/dev/null || true
echo
case "$token" in
  *[!0-9a-f]* | '') echo "That isn't a server token (64 characters, 0-9 and a-f)." >&2; exit 1 ;;
esac
if [ "${#token}" -ne 64 ]; then
  echo "That isn't a server token (64 characters, 0-9 and a-f)." >&2
  exit 1
fi

# services to watch: the usual ones that are running here; Enter keeps them
found=''
for name in nginx apache2 caddy docker postgresql mariadb mysql redis-server; do
  if systemctl is-active --quiet "$name" 2>/dev/null; then found="$found $name"; fi
done
found=${found# }
printf 'Services to watch [%s]: ' "$found"
read -r services < /dev/tty || services=''
services=${services:-$found}
printf 'Domain whose TLS certificate to check (optional, Enter to skip): '
read -r cert_host < /dev/tty || cert_host=''

if command -v curl >/dev/null 2>&1; then :; else
  echo "curl is needed – install it first (apt-get install -y curl)." >&2
  exit 1
fi
curl -fsSL "$AGENT_SOURCE" -o /usr/local/bin/habits-agent
chmod 755 /usr/local/bin/habits-agent

umask 077
cat > "$CONF" <<EOF
# Habits server health agent – written by install.sh
HABITS_URL='$url'
HABITS_TOKEN='$token'
SERVICES='$services'
CERT_HOST='$cert_host'
DISK_PATH='/'
EOF
chmod 600 "$CONF"
umask 022

cat > "$UNIT_DIR/habits-agent.service" <<'EOF'
[Unit]
Description=Habits server health agent (sends figures to the Habits app)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/habits-agent
Nice=10
ProtectHome=yes
PrivateTmp=yes
EOF

cat > "$UNIT_DIR/habits-agent.timer" <<'EOF'
[Unit]
Description=Run the Habits server health agent every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
RandomizedDelaySec=20s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now habits-agent.timer
if /usr/local/bin/habits-agent; then
  echo "Done – the first report is on its way. It shows in the app within a minute."
else
  echo "Installed, but the first report failed. Check the address and token, then: sudo systemctl start habits-agent" >&2
  exit 1
fi
