#!/usr/bin/env bash
# YMS 本地 API + 内网穿透 一键管理脚本
#
# 用法：
#   bash scripts/local-stack.sh start     # 启动 API 与穿透，输出公网地址
#   bash scripts/local-stack.sh stop      # 停止穿透与 API
#   bash scripts/local-stack.sh status    # 查看运行状态与公网地址
#   bash scripts/local-stack.sh url       # 仅输出当前公网地址
#
# 可选环境变量：
#   API_PORT=8787                 API 端口
#   YMS_API_TOKEN=xxx             启用 API 鉴权（页面「访问令牌」需填同一值）
#   TUNNEL_MODE=auto|cloudflared|ngrok|ssh   穿透方式，默认 auto 自动探测
#
# 穿透优先级：cloudflared > ngrok > ssh(localhost.run，适合受限网络)

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 自动加载 .env.local（如果存在且未显式设置）
if [ -f "$ROOT_DIR/.env.local" ]; then
  # shellcheck disable=SC1090
  set -a
  . "$ROOT_DIR/.env.local"
  set +a
fi

RUN_DIR="$ROOT_DIR/server/data/.run"
LOG_DIR="$RUN_DIR/logs"
API_PID_FILE="$RUN_DIR/api.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
TUNNEL_URL_FILE="$RUN_DIR/tunnel-url.txt"
API_LOG="$LOG_DIR/api.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

API_PORT="${API_PORT:-8787}"
TUNNEL_MODE="${TUNNEL_MODE:-auto}"

mkdir -p "$LOG_DIR"

info() { printf '\033[36m[yms]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[yms]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[31m[yms]\033[0m %s\n' "$*" >&2; exit 1; }

pid_alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

# 后台启动并写入真实 PID（Linux 用 setsid 脱离当前会话，避免终端退出后被杀）
start_daemon() {
  local pidfile="$1" logfile="$2"
  shift 2
  if command -v setsid >/dev/null 2>&1; then
    setsid bash -c 'echo $$ > "$1"; shift; exec "$@"' _ "$pidfile" "$@" >>"$logfile" 2>&1 &
  else
    nohup "$@" >>"$logfile" 2>&1 &
    echo $! >"$pidfile"
  fi
}

read_pid() {
  local file="$1"
  [ -f "$file" ] && cat "$file" 2>/dev/null || true
}

api_health() {
  curl -fsS -m 3 "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1
}

start_api() {
  if api_health; then
    info "API 已在运行：http://127.0.0.1:$API_PORT"
    return 0
  fi
  info "启动本地 API（端口 $API_PORT，日志 $API_LOG）"
  start_daemon "$API_PID_FILE" "$API_LOG" node "$ROOT_DIR/server/index.mjs"

  for _ in $(seq 1 20); do
    sleep 0.5
    api_health && { info "API 健康检查通过"; return 0; }
  done
  fail "API 启动失败，请查看 $API_LOG"
}

stop_api() {
  local pid
  pid="$(read_pid "$API_PID_FILE")"
  if pid_alive "$pid"; then
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 10); do
      pid_alive "$pid" || break
      sleep 0.3
    done
    pid_alive "$pid" && kill -9 "$pid" 2>/dev/null
    info "API 已停止 (pid $pid)"
  else
    warn "未找到由本脚本启动的 API 进程"
  fi
  rm -f "$API_PID_FILE"
}

detect_tunnel_mode() {
  if [ "$TUNNEL_MODE" != "auto" ]; then
    echo "$TUNNEL_MODE"
    return
  fi
  if command -v cloudflared >/dev/null 2>&1; then echo cloudflared; return; fi
  if command -v ngrok >/dev/null 2>&1; then echo ngrok; return; fi
  if command -v ssh >/dev/null 2>&1; then echo ssh; return; fi
  echo none
}

tunnel_url_from_log() {
  sed -e 's/\x1b\[[0-9;]*m//g' "$TUNNEL_LOG" 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com|https://[a-z0-9]{8,}\.(lhr\.life|localhost\.run)' \
    | head -1
}

start_tunnel() {
  stop_tunnel >/dev/null 2>&1 || true
  : >"$TUNNEL_LOG"
  rm -f "$TUNNEL_URL_FILE"

  local mode
  mode="$(detect_tunnel_mode)"
  info "穿透方式：$mode"

  case "$mode" in
    cloudflared)
      start_daemon "$TUNNEL_PID_FILE" "$TUNNEL_LOG" cloudflared tunnel --url "http://localhost:$API_PORT" --no-autoupdate
      ;;
    ngrok)
      start_daemon "$TUNNEL_PID_FILE" "$TUNNEL_LOG" ngrok http "$API_PORT"
      ;;
    ssh)
      local proxy_args=()
      local proxy="${HTTPS_PROXY:-${https_proxy:-}}"
      if [ -n "$proxy" ] && command -v nc >/dev/null 2>&1; then
        local host port
        proxy="${proxy#*://}"
        host="${proxy%%:*}"
        port="${proxy##*:}"
        proxy_args=(-o "ProxyCommand=nc -X connect -x ${host}:${port} %h %p")
        info "SSH 走代理 $host:$port"
      fi
      start_daemon "$TUNNEL_PID_FILE" "$TUNNEL_LOG" ssh -T "${proxy_args[@]}" \
        -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
        -R 80:localhost:"$API_PORT" nokey@localhost.run
      ;;
    none)
      fail "未检测到 cloudflared / ngrok / ssh，请先安装其一：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
      ;;
    *)
      fail "未知 TUNNEL_MODE：$mode"
      ;;
  esac

  local url=""
  for _ in $(seq 1 120); do
    sleep 0.5
    if [ "$mode" = "ngrok" ]; then
      url="$(curl -s -m 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
        | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4)"
    else
      url="$(tunnel_url_from_log)"
    fi
    [ -n "$url" ] && break
    pid_alive "$(read_pid "$TUNNEL_PID_FILE")" || break
  done

  if [ -z "$url" ]; then
    warn "未能获取公网地址，隧道日志："
    sed -e 's/\x1b\[[0-9;]*m//g' "$TUNNEL_LOG" | tail -15 >&2
    fail "穿透启动失败"
  fi

  echo "$url" >"$TUNNEL_URL_FILE"
  info "公网地址：$url"
  info "把该地址填入站点「表单数据采集 → ② 同步配置」并保存，点击「测试连接」应显示 ✓ 已连通"
}

stop_tunnel() {
  local pid
  pid="$(read_pid "$TUNNEL_PID_FILE")"
  if pid_alive "$pid"; then
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 10); do
      pid_alive "$pid" || break
      sleep 0.3
    done
    pid_alive "$pid" && kill -9 "$pid" 2>/dev/null
    info "穿透已停止 (pid $pid)"
  fi
  rm -f "$TUNNEL_PID_FILE" "$TUNNEL_URL_FILE"
}

status() {
  if api_health; then
    info "API：运行中 http://127.0.0.1:$API_PORT"
  else
    warn "API：未运行"
  fi
  local url
  url="$(cat "$TUNNEL_URL_FILE" 2>/dev/null || true)"
  if [ -n "$url" ]; then
    info "隧道路由：$url"
    if curl -fsS -m 8 "$url/api/health" >/dev/null 2>&1; then
      info "隧道连通性：正常"
    else
      warn "隧道连通性：不可达（可能已过期，请重新 start）"
    fi
  else
    warn "隧道：未启动"
  fi
}

case "${1:-}" in
  start)
    start_api
    start_tunnel
    ;;
  stop)
    stop_tunnel
    stop_api
    ;;
  status)
    status
    ;;
  url)
    cat "$TUNNEL_URL_FILE" 2>/dev/null || warn "尚无公网地址"
    ;;
  *)
    printf '用法：bash scripts/local-stack.sh {start|stop|status|url}\n'
    ;;
esac
