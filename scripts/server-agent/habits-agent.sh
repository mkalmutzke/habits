#!/bin/sh
# Habits server health agent (v3.8). Runs every 5 minutes (systemd timer, see
# install.sh), reads a few figures of this server and sends them to the
# Habits app (Edge Function server-ingest). It only reads and sends; it opens
# no port and changes nothing. Settings live in /etc/habits-agent.conf:
#   HABITS_URL    the server-ingest address shown in the app
#   HABITS_TOKEN  this server's token (shown once in the app; file is root-only)
#   SERVICES      systemd services to watch, e.g. "nginx docker"
#   CERT_HOST     optional: a domain whose TLS certificate is checked
#   DISK_PATH     the disk to measure (default /)
# Checks that need a missing tool (docker, apt, openssl) are left out.
set -eu

CONF=${HABITS_AGENT_CONF:-/etc/habits-agent.conf}
CACHE=${HABITS_AGENT_CACHE:-/var/cache/habits-agent}
# shellcheck disable=SC1090
. "$CONF"
: "${HABITS_URL:?HABITS_URL missing in $CONF}"
: "${HABITS_TOKEN:?HABITS_TOKEN missing in $CONF}"
SERVICES=${SERVICES:-}
CERT_HOST=${CERT_HOST:-}
DISK_PATH=${DISK_PATH:-/}

have() { command -v "$1" >/dev/null 2>&1; }
num_or_null() { case "$1" in '' | *[!0-9.-]*) printf 'null' ;; *) printf '%s' "$1" ;; esac; }

# CPU in use, in percent, measured over one second
cpu_sample() { awk '/^cpu / { idle = $5 + $6; total = 0; for (i = 2; i <= NF; i++) total += $i; print idle, total }' /proc/stat; }
set -- $(cpu_sample)
idle1=$1 total1=$2
sleep 1
set -- $(cpu_sample)
cpu=$(awk -v i1="$idle1" -v t1="$total1" -v i2="$1" -v t2="$2" 'BEGIN { dt = t2 - t1; if (dt <= 0) print ""; else printf "%.1f", 100 * (1 - (i2 - i1) / dt) }')

read -r load1 load5 load15 _ < /proc/loadavg
memory_total=$(awk '/^MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo)
memory_available=$(awk '/^MemAvailable:/ { printf "%d", $2 / 1024 }' /proc/meminfo)
memory_used=$((memory_total - memory_available))
set -- $(df -Pk "$DISK_PATH" | awk 'NR == 2 { printf "%.2f %.2f", $3 / 1048576, $2 / 1048576 }')
disk_used=$1 disk_total=$2
uptime_s=$(awk '{ printf "%d", $1 }' /proc/uptime)

# the watched services: [{"name":"nginx","active":true}, …]
services='['
first=1
for name in $SERVICES; do
  case "$name" in *[!A-Za-z0-9@._:-]*) continue ;; esac
  if have systemctl && systemctl is-active --quiet "$name" 2>/dev/null; then active=true; else active=false; fi
  [ "$first" -eq 1 ] || services="$services,"
  services="$services{\"name\":\"$name\",\"active\":$active}"
  first=0
done
services="$services]"

containers_running='' containers_total=''
if have docker && docker info >/dev/null 2>&1; then
  containers_running=$(docker ps -q | wc -l | tr -d ' ')
  containers_total=$(docker ps -aq | wc -l | tr -d ' ')
fi

# pending updates (Debian/Ubuntu): counted at most once an hour, it takes a moment
updates='' reboot=null
if have apt-get; then
  mkdir -p "$CACHE"
  if [ -z "$(find "$CACHE/updates" -mmin -60 2>/dev/null)" ]; then
    apt-get -s -o Debug::NoLocking=1 upgrade 2>/dev/null | grep -c '^Inst ' > "$CACHE/updates" || true
  fi
  updates=$(cat "$CACHE/updates" 2>/dev/null || true)
  if [ -f /var/run/reboot-required ]; then reboot=true; else reboot=false; fi
fi

cert_days=''
if [ -n "$CERT_HOST" ] && have openssl; then
  end=$(echo | openssl s_client -servername "$CERT_HOST" -connect "$CERT_HOST:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)
  if [ -n "$end" ]; then
    end_s=$(date -d "$end" +%s 2>/dev/null || true)
    [ -z "$end_s" ] || cert_days=$(( (end_s - $(date +%s)) / 86400 ))
  fi
fi

report=$(printf '{"cpu":%s,"load1":%s,"load5":%s,"load15":%s,"memory_used_mb":%s,"memory_total_mb":%s,"disk_used_gb":%s,"disk_total_gb":%s,"uptime_s":%s,"services":%s,"containers_running":%s,"containers_total":%s,"updates_pending":%s,"reboot_required":%s,"cert_days":%s}' \
  "$(num_or_null "$cpu")" "$(num_or_null "$load1")" "$(num_or_null "$load5")" "$(num_or_null "$load15")" \
  "$(num_or_null "$memory_used")" "$(num_or_null "$memory_total")" "$(num_or_null "$disk_used")" "$(num_or_null "$disk_total")" \
  "$(num_or_null "$uptime_s")" "$services" "$(num_or_null "$containers_running")" "$(num_or_null "$containers_total")" \
  "$(num_or_null "$updates")" "$reboot" "$(num_or_null "$cert_days")")

# The token goes to curl on standard input, so it never shows in the process list.
printf 'Authorization: Bearer %s\n' "$HABITS_TOKEN" |
  curl -fsS --max-time 20 -X POST "$HABITS_URL" -H @- -H 'Content-Type: application/json' --data "$report" >/dev/null
