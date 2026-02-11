#!/bin/bash
# ==============================================
# VelocityPulse Agent Installer (Linux / macOS)
# One-liner: curl -sSL https://get.velocitypulse.io/agent.sh | sudo -E bash
# ==============================================

set -e

INSTALLER_VERSION="4.0.0"
INSTALL_DIR="/opt/velocitypulse-agent"
SERVICE_NAME="velocitypulse-agent"
PLIST_PATH="/Library/LaunchDaemons/io.velocitypulse.agent.plist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Runtime state
OS_TYPE="unknown"
MODE=""
FORCE_MODE=false
HAS_API_KEY_OVERRIDE=false
HAS_DASHBOARD_OVERRIDE=false
HAS_AGENT_NAME_OVERRIDE=false
EXISTING_INSTALL=false
REUSE_EXISTING_CONFIG=false
DOWNLOAD_VERSION="latest"

VP_API_KEY="${VP_API_KEY:-}"
DASHBOARD_URL="${VELOCITYPULSE_URL:-}"
AGENT_NAME="${AGENT_NAME:-}"

EXISTING_API_KEY=""
EXISTING_DASHBOARD_URL=""
EXISTING_AGENT_NAME=""
TEMP_DIR=""
TEMP_ZIP=""
ENV_BACKUP_PATH=""
REPO="velocityeu/velocitypulse"

print_banner() {
    echo ""
    echo -e "${CYAN}  ==================================================${NC}"
    echo -e "${CYAN}   VelocityPulse Agent Installer v${INSTALLER_VERSION} (${OS_TYPE})${NC}"
    echo -e "${CYAN}   Velocity Technology Group  |  velocitypulse.io${NC}"
    echo -e "${CYAN}  ==================================================${NC}"
    echo ""
}

detect_os() {
    case "$(uname -s)" in
        Linux*)  OS_TYPE="linux" ;;
        Darwin*) OS_TYPE="macos" ;;
        *)       echo -e "${RED}  ERROR: Unsupported OS: $(uname -s)${NC}"; exit 1 ;;
    esac
}

require_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}  ERROR: Please run as root (sudo).${NC}"
        exit 1
    fi
}

usage() {
    cat << USAGE
Usage: install-linux.sh [options]

Options:
  --fresh                 Fresh install (remove existing and reinstall)
  --upgrade               Upgrade existing installation and preserve config
  --uninstall             Remove agent, service, and installation directory
  --force                 Non-interactive (defaults to upgrade if existing)
  --api-key <key>         Agent API key
  --dashboard-url <url>   Dashboard URL (default: https://app.velocitypulse.io)
  --agent-name <name>     Agent display name
  --help                  Show help
USAGE
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fresh)
                MODE="fresh"
                shift
                ;;
            --upgrade)
                MODE="upgrade"
                shift
                ;;
            --uninstall)
                MODE="uninstall"
                shift
                ;;
            --force|--yes|--non-interactive)
                FORCE_MODE=true
                shift
                ;;
            --api-key)
                VP_API_KEY="$2"
                HAS_API_KEY_OVERRIDE=true
                shift 2
                ;;
            --dashboard-url)
                DASHBOARD_URL="$2"
                HAS_DASHBOARD_OVERRIDE=true
                shift 2
                ;;
            --agent-name)
                AGENT_NAME="$2"
                HAS_AGENT_NAME_OVERRIDE=true
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                echo -e "${RED}  ERROR: Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done
}

service_exists() {
    if [ "$OS_TYPE" = "linux" ]; then
        if command -v systemctl &>/dev/null; then
            if systemctl status "$SERVICE_NAME" &>/dev/null; then
                return 0
            fi
            if systemctl list-unit-files "$SERVICE_NAME.service" --no-legend 2>/dev/null | grep -q "^$SERVICE_NAME.service"; then
                return 0
            fi
        fi
    elif [ "$OS_TYPE" = "macos" ]; then
        if [ -f "$PLIST_PATH" ]; then
            return 0
        fi
        if launchctl list 2>/dev/null | grep -q "io\.velocitypulse\.agent"; then
            return 0
        fi
    fi
    return 1
}

has_existing_install() {
    if [ -d "$INSTALL_DIR" ]; then
        return 0
    fi
    if service_exists; then
        return 0
    fi
    return 1
}

read_env_value() {
    local key="$1"
    local env_file="$INSTALL_DIR/.env"
    if [ ! -f "$env_file" ]; then
        return
    fi
    local value
    value=$(grep -E "^${key}=" "$env_file" 2>/dev/null | head -n1 | cut -d'=' -f2- || true)
    echo "$value"
}

load_existing_env() {
    EXISTING_DASHBOARD_URL="$(read_env_value "VELOCITYPULSE_URL")"
    EXISTING_API_KEY="$(read_env_value "VP_API_KEY")"
    EXISTING_AGENT_NAME="$(read_env_value "AGENT_NAME")"
}

choose_mode() {
    if [ -n "$MODE" ]; then
        return
    fi

    if [ "$EXISTING_INSTALL" != "true" ]; then
        MODE="fresh"
        return
    fi

    if [ "$FORCE_MODE" = true ]; then
        MODE="upgrade"
        return
    fi

    echo -e "${YELLOW}  Existing installation detected at $INSTALL_DIR${NC}"
    echo ""
    echo "  Select operation:"
    echo "    1) Upgrade       (preserve current config)"
    echo "    2) Fresh install (remove old install, then configure again)"
    echo "    3) Uninstall     (remove agent and exit)"
    echo "    4) Cancel"
    echo ""

    local choice
    read -rp "  Enter choice [1-4]: " choice < /dev/tty
    case "$choice" in
        1) MODE="upgrade" ;;
        2) MODE="fresh" ;;
        3) MODE="uninstall" ;;
        *)
            echo -e "${YELLOW}  Cancelled.${NC}"
            exit 0
            ;;
    esac
}

stop_and_remove_service() {
    if [ "$OS_TYPE" = "linux" ]; then
        if command -v systemctl &>/dev/null; then
            systemctl stop "$SERVICE_NAME" 2>/dev/null || true
            systemctl disable "$SERVICE_NAME" 2>/dev/null || true
            rm -f "/etc/systemd/system/$SERVICE_NAME.service"
            systemctl daemon-reload 2>/dev/null || true
        fi
    elif [ "$OS_TYPE" = "macos" ]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        rm -f "$PLIST_PATH"
    fi
}

remove_install_dir() {
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
    fi
}

install_node() {
    echo -e "${YELLOW}  Node.js not found. Installing automatically...${NC}"

    if [ "$OS_TYPE" = "linux" ]; then
        if command -v apt-get &>/dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs
        elif command -v dnf &>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            dnf install -y nodejs
        elif command -v yum &>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            yum install -y nodejs
        else
            echo -e "${RED}  ERROR: Could not detect package manager (apt-get, dnf, yum).${NC}"
            echo -e "${RED}  Please install Node.js 18+ manually: https://nodejs.org${NC}"
            exit 1
        fi
    elif [ "$OS_TYPE" = "macos" ]; then
        if [ -f /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi

        if command -v brew &>/dev/null; then
            echo "  Installing Node.js via Homebrew..."
            brew install node@22
            brew link --overwrite node@22 2>/dev/null || true
            if [ -f /opt/homebrew/bin/brew ]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            fi
        else
            echo "  Homebrew not found. Installing Node.js via official pkg installer..."
            local arch
            arch=$(uname -m)
            local node_pkg_url
            if [ "$arch" = "arm64" ]; then
                node_pkg_url="https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-arm64.pkg"
            else
                node_pkg_url="https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.pkg"
            fi
            local node_pkg_tmp
            node_pkg_tmp=$(mktemp -d)/node.pkg
            curl -fsSL "$node_pkg_url" -o "$node_pkg_tmp"
            installer -pkg "$node_pkg_tmp" -target /
            rm -f "$node_pkg_tmp"
        fi
    fi

    hash -r 2>/dev/null || true
    if ! command -v node &>/dev/null; then
        echo -e "${RED}  ERROR: Node.js installation failed. Please install manually.${NC}"
        exit 1
    fi
    echo -e "${GREEN}  Node.js $(node --version) installed${NC}"
}

ensure_node() {
    if [ "$OS_TYPE" = "macos" ] && [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    if ! command -v node &>/dev/null; then
        install_node
        return
    fi

    local node_major
    node_major=$(node --version | sed 's/^v//' | cut -d. -f1)
    if [ "$node_major" -lt 18 ]; then
        echo -e "${YELLOW}  Node.js $(node --version) is too old (18+ required). Installing newer version...${NC}"
        install_node
    fi
}

prompt_config() {
    echo ""
    echo -e "${YELLOW}[2/6] Configuration${NC}"

    load_existing_env

    if [ "$MODE" = "upgrade" ] && [ "$HAS_API_KEY_OVERRIDE" = false ] && [ "$HAS_DASHBOARD_OVERRIDE" = false ] && [ "$HAS_AGENT_NAME_OVERRIDE" = false ] && [ -f "$INSTALL_DIR/.env" ]; then
        if [ -n "$EXISTING_API_KEY" ] && [ -n "$EXISTING_DASHBOARD_URL" ]; then
            VP_API_KEY="$EXISTING_API_KEY"
            DASHBOARD_URL="$EXISTING_DASHBOARD_URL"
            AGENT_NAME="${EXISTING_AGENT_NAME:-${AGENT_NAME:-$(hostname)}}"
            REUSE_EXISTING_CONFIG=true
            echo -e "${GREEN}  Upgrade mode: reusing existing .env configuration${NC}"
            echo -e "${GREEN}  Dashboard: $DASHBOARD_URL${NC}"
            echo -e "${GREEN}  Agent Name: $AGENT_NAME${NC}"
            return
        fi
    fi

    if [ -z "$DASHBOARD_URL" ]; then
        DASHBOARD_URL="${EXISTING_DASHBOARD_URL:-https://app.velocitypulse.io}"
    fi

    if [ -z "$AGENT_NAME" ]; then
        AGENT_NAME="${EXISTING_AGENT_NAME:-$(hostname)}"
    fi

    if [ "$FORCE_MODE" = false ]; then
        if [ -z "$VP_API_KEY" ]; then
            if [ -n "$EXISTING_API_KEY" ] && [ "$MODE" = "upgrade" ]; then
                local use_existing
                read -rp "  Reuse existing Agent API Key from .env? [Y/n]: " use_existing < /dev/tty
                if [ -z "$use_existing" ] || [ "$use_existing" = "y" ] || [ "$use_existing" = "Y" ]; then
                    VP_API_KEY="$EXISTING_API_KEY"
                fi
            fi
        fi

        if [ -z "$VP_API_KEY" ]; then
            read -rp "  Enter your Agent API Key: " VP_API_KEY < /dev/tty
        fi

        local input_url
        read -rp "  Dashboard URL (Enter for $DASHBOARD_URL): " input_url < /dev/tty
        if [ -n "$input_url" ]; then
            DASHBOARD_URL="$input_url"
        fi

        local input_name
        read -rp "  Agent Name (Enter for $AGENT_NAME): " input_name < /dev/tty
        if [ -n "$input_name" ]; then
            AGENT_NAME="$input_name"
        fi
    fi

    if [ -z "$VP_API_KEY" ]; then
        echo -e "${RED}  ERROR: API key is required.${NC}"
        echo -e "${RED}  Use --api-key <key> or set VP_API_KEY in environment.${NC}"
        exit 1
    fi

    if [ -z "$DASHBOARD_URL" ]; then
        DASHBOARD_URL="https://app.velocitypulse.io"
    fi

    echo -e "${GREEN}  Dashboard: $DASHBOARD_URL${NC}"
    echo -e "${GREEN}  Agent Name: $AGENT_NAME${NC}"
}

download_release() {
    echo ""
    echo -e "${YELLOW}[3/6] Downloading latest agent release...${NC}"

    TEMP_DIR=$(mktemp -d)
    TEMP_ZIP="$TEMP_DIR/agent.tar.gz"
    local downloaded_ok=false

    local dashboard_download_url
    dashboard_download_url="${DASHBOARD_URL%/}/api/agent/download?format=tgz"
    if curl -fsSL "$dashboard_download_url" -o "$TEMP_ZIP" 2>/dev/null && tar -tzf "$TEMP_ZIP" &>/dev/null; then
        downloaded_ok=true
        DOWNLOAD_VERSION="latest"
        echo -e "${GREEN}  Downloaded via dashboard endpoint${NC}"
    fi

    if [ "$downloaded_ok" != "true" ]; then
        echo -e "${YELLOW}  Dashboard download unavailable. Falling back to GitHub release source...${NC}"

        local releases_url
        releases_url="https://api.github.com/repos/$REPO/releases"
        local download_url=""

        if command -v curl &>/dev/null; then
            local releases_tmp
            releases_tmp=$(mktemp)
            if [ -n "$GITHUB_TOKEN" ]; then
                curl -sL -H "User-Agent: VelocityPulse-Installer" -H "Authorization: token $GITHUB_TOKEN" "$releases_url" -o "$releases_tmp" 2>/dev/null
            else
                curl -sL -H "User-Agent: VelocityPulse-Installer" "$releases_url" -o "$releases_tmp" 2>/dev/null
            fi

            local parsed
            parsed=$(node -e "
              const d=require('fs').readFileSync('$releases_tmp','utf8');
              try {
                const releases=JSON.parse(d);
                const r=Array.isArray(releases)?releases.find(x=>x.tag_name&&x.tag_name.startsWith('agent-v')):null;
                if(!r)process.exit(0);
                const a=(r.assets||[]).find(x=>x.name&&x.name.endsWith('.tar.gz'));
                console.log(r.tag_name);
                console.log(a?a.id:'');
                console.log(a?a.browser_download_url:'');
              } catch(e) {}
            " 2>/dev/null || echo "")
            rm -f "$releases_tmp"

            local agent_tag
            local asset_id
            local asset_browser_url
            agent_tag=$(echo "$parsed" | sed -n '1p')
            asset_id=$(echo "$parsed" | sed -n '2p')
            asset_browser_url=$(echo "$parsed" | sed -n '3p')

            if [ -n "$agent_tag" ]; then
                if [ -n "$asset_id" ] && [ -n "$GITHUB_TOKEN" ]; then
                    download_url="https://api.github.com/repos/$REPO/releases/assets/$asset_id"
                elif [ -n "$asset_browser_url" ]; then
                    download_url="$asset_browser_url"
                fi
                DOWNLOAD_VERSION="$agent_tag"
                echo -e "${GREEN}  Version: $DOWNLOAD_VERSION${NC}"
            fi
        fi

        if [ -z "$download_url" ]; then
            echo -e "${YELLOW}  Could not find a release. Falling back to main branch archive...${NC}"
            if [ -n "$GITHUB_TOKEN" ]; then
                download_url="https://api.github.com/repos/$REPO/tarball/main"
            else
                download_url="https://github.com/$REPO/archive/refs/heads/main.tar.gz"
            fi
            DOWNLOAD_VERSION="latest"
        fi

        if [ -n "$GITHUB_TOKEN" ]; then
            curl -sL -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/octet-stream" "$download_url" -o "$TEMP_ZIP"
        else
            curl -sL "$download_url" -o "$TEMP_ZIP"
        fi

        if [ ! -s "$TEMP_ZIP" ]; then
            echo -e "${RED}  ERROR: Download failed. Check network or GITHUB_TOKEN.${NC}"
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        if ! tar -tzf "$TEMP_ZIP" &>/dev/null; then
            echo -e "${RED}  ERROR: Downloaded file is not a valid archive.${NC}"
            echo -e "${RED}  Checked sources:${NC}"
            echo -e "${RED}    1) ${DASHBOARD_URL%/}/api/agent/download${NC}"
            echo -e "${RED}    2) GitHub release archive for $REPO${NC}"
            echo -e "${RED}  Retry shortly, or set GITHUB_TOKEN for authenticated API fallback if rate-limited.${NC}"
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        echo -e "${GREEN}  Downloaded${NC}"
    fi
}

prepare_install_target() {
    if [ "$EXISTING_INSTALL" != "true" ]; then
        return
    fi

    echo ""
    echo -e "${YELLOW}  Preparing ${MODE} operation...${NC}"

    if [ "$MODE" = "upgrade" ] && [ -f "$INSTALL_DIR/.env" ]; then
        ENV_BACKUP_PATH=$(mktemp)
        cp "$INSTALL_DIR/.env" "$ENV_BACKUP_PATH"
    fi

    stop_and_remove_service
    remove_install_dir

    echo -e "${GREEN}  Existing installation cleaned${NC}"
}

install_files() {
    echo ""
    echo -e "${YELLOW}[4/6] Installing to $INSTALL_DIR...${NC}"

    mkdir -p "$INSTALL_DIR"
    tar -xzf "$TEMP_ZIP" -C "$TEMP_DIR"

    local source_dir
    source_dir=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
    if [ -z "$source_dir" ]; then
        echo -e "${RED}  ERROR: Could not find extracted directory.${NC}"
        exit 1
    fi

    if [ -d "$source_dir/velocitypulse-agent" ]; then
        source_dir="$source_dir/velocitypulse-agent"
    fi

    cp -rf "$source_dir"/* "$INSTALL_DIR/"
    echo -e "${GREEN}  Files installed${NC}"

    cd "$INSTALL_DIR"
    if [ -f "$INSTALL_DIR/dist/index.js" ]; then
        echo "  Pre-built dist/ found. Installing production dependencies..."
        npm install --production --silent 2>/dev/null
    else
        echo -e "${YELLOW}  No pre-built dist/ found. Building from source...${NC}"
        echo "  Installing dependencies (this may take a minute)..."
        npm install --silent 2>/dev/null
        echo "  Building agent..."
        npm run build 2>/dev/null
        if [ ! -f "$INSTALL_DIR/dist/index.js" ]; then
            echo -e "${RED}  ERROR: Build failed. dist/index.js not found.${NC}"
            exit 1
        fi
        echo -e "${GREEN}  Build completed${NC}"
    fi

    echo -e "${GREEN}  Dependencies installed${NC}"
}

update_env_key() {
    local file="$1"
    local key="$2"
    local value="$3"
    local escaped
    escaped=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')

    if grep -qE "^${key}=" "$file"; then
        sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$file"
        rm -f "${file}.bak"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

configure_env_file() {
    echo ""
    echo -e "${YELLOW}[5/6] Configuring agent...${NC}"

    local env_file="$INSTALL_DIR/.env"

    if [ "$MODE" = "upgrade" ] && [ -n "$ENV_BACKUP_PATH" ] && [ -f "$ENV_BACKUP_PATH" ]; then
        cp "$ENV_BACKUP_PATH" "$env_file"
    fi

    if [ ! -f "$env_file" ]; then
        cat > "$env_file" << ENVEOF
# VelocityPulse Agent Configuration
VELOCITYPULSE_URL=$DASHBOARD_URL
VP_API_KEY=$VP_API_KEY
AGENT_NAME=$AGENT_NAME
LOG_LEVEL=info
ENABLE_AUTO_SCAN=true
ENABLE_REALTIME=true
AGENT_UI_ENABLED=true
AGENT_UI_HOST=127.0.0.1
ENVEOF
    fi

    update_env_key "$env_file" "VELOCITYPULSE_URL" "$DASHBOARD_URL"
    update_env_key "$env_file" "VP_API_KEY" "$VP_API_KEY"
    update_env_key "$env_file" "AGENT_NAME" "$AGENT_NAME"
    update_env_key "$env_file" "LOG_LEVEL" "info"
    update_env_key "$env_file" "ENABLE_AUTO_SCAN" "true"
    update_env_key "$env_file" "ENABLE_REALTIME" "true"
    update_env_key "$env_file" "AGENT_UI_ENABLED" "true"
    update_env_key "$env_file" "AGENT_UI_HOST" "127.0.0.1"

    chmod 600 "$env_file"
    echo -e "${GREEN}  Configuration written to .env${NC}"
}

create_service() {
    echo ""

    local node_path
    node_path=$(which node)
    mkdir -p "$INSTALL_DIR/logs"

    if [ "$OS_TYPE" = "linux" ]; then
        echo -e "${YELLOW}[6/6] Creating systemd service...${NC}"

        cat > "/etc/systemd/system/$SERVICE_NAME.service" << SERVICEEOF
[Unit]
Description=VelocityPulse Network Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$node_path $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security hardening
NoNewPrivileges=false
ProtectSystem=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICEEOF

        systemctl daemon-reload
        systemctl enable "$SERVICE_NAME"
        systemctl start "$SERVICE_NAME"

        echo -e "${GREEN}  Service created and started${NC}"

    elif [ "$OS_TYPE" = "macos" ]; then
        echo -e "${YELLOW}[6/6] Creating launchd service...${NC}"

        cat > "$PLIST_PATH" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.velocitypulse.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$node_path</string>
        <string>$INSTALL_DIR/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/logs/service.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/logs/service-error.log</string>
</dict>
</plist>
PLISTEOF

        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        launchctl load "$PLIST_PATH"

        echo -e "${GREEN}  Service created and started${NC}"
    fi
}

resolve_setup_code() {
    local payload=""
    local setup_code=""

    for _ in 1 2 3 4 5 6 7 8 9 10; do
        payload=$(curl -fsSL "http://127.0.0.1:3001/api/auth/local/setup-code" 2>/dev/null || true)
        if [ -n "$payload" ]; then
            setup_code=$(printf '%s' "$payload" | node -e "
              let d='';
              process.stdin.on('data', c => d += c);
              process.stdin.on('end', () => {
                try {
                  const parsed = JSON.parse(d);
                  if (typeof parsed.setup_code === 'string') process.stdout.write(parsed.setup_code);
                } catch {}
              });
            " 2>/dev/null || true)
            if [ -n "$setup_code" ]; then
                echo "$setup_code"
                return 0
            fi
        fi
        sleep 1
    done

    return 1
}

print_uninstall_summary() {
    echo ""
    echo -e "${GREEN}  ==================================================${NC}"
    echo -e "${GREEN}   VelocityPulse Agent Uninstalled${NC}"
    echo -e "${GREEN}  ==================================================${NC}"
    echo ""
    echo -e "${CYAN}  Removed: $INSTALL_DIR${NC}"
    if [ "$OS_TYPE" = "linux" ]; then
        echo -e "${CYAN}  Service removed: $SERVICE_NAME${NC}"
    else
        echo -e "${CYAN}  Service removed: io.velocitypulse.agent${NC}"
    fi
    echo ""
}

print_install_summary() {
    local completion_label="Installation Complete!"
    if [ "$MODE" = "upgrade" ]; then
        completion_label="Upgrade Complete!"
    elif [ "$MODE" = "fresh" ] && [ "$EXISTING_INSTALL" = "true" ]; then
        completion_label="Fresh Install Complete!"
    fi

    local setup_code
    setup_code=$(resolve_setup_code || true)

    echo ""
    echo -e "${GREEN}  ==================================================${NC}"
    echo -e "${GREEN}   ${completion_label}${NC}"
    echo -e "${GREEN}  ==================================================${NC}"
    echo ""
    echo -e "${CYAN}  Install Dir:  $INSTALL_DIR${NC}"
    echo -e "${CYAN}  Service Name: $SERVICE_NAME${NC}"
    echo -e "${CYAN}  Dashboard:    $DASHBOARD_URL${NC}"
    echo -e "${CYAN}  Agent UI:     http://127.0.0.1:3001${NC}"
    echo -e "${CYAN}  Release:      $DOWNLOAD_VERSION${NC}"
    if [ -n "$setup_code" ]; then
        echo -e "${CYAN}  Setup code:   $setup_code${NC}"
    elif [ "$OS_TYPE" = "linux" ]; then
        echo "  Setup code:   journalctl -u $SERVICE_NAME -n 200 | grep \"setup code\" | tail -1"
    else
        echo "  Setup code:   tail -n 200 $INSTALL_DIR/logs/service.log | grep \"setup code\" | tail -1"
    fi
    echo ""

    if [ "$OS_TYPE" = "linux" ]; then
        echo -e "${YELLOW}  Commands:${NC}"
        echo "    Start:   systemctl start $SERVICE_NAME"
        echo "    Stop:    systemctl stop $SERVICE_NAME"
        echo "    Status:  systemctl status $SERVICE_NAME"
        echo "    Logs:    journalctl -u $SERVICE_NAME -f"
        echo "    Remove:  curl -sSL https://get.velocitypulse.io/agent.sh | sudo bash -s -- --uninstall"
    else
        echo -e "${YELLOW}  Commands:${NC}"
        echo "    Status:  sudo launchctl list | grep velocitypulse"
        echo "    Stop:    sudo launchctl unload $PLIST_PATH"
        echo "    Start:   sudo launchctl load $PLIST_PATH"
        echo "    Logs:    tail -f $INSTALL_DIR/logs/service.log"
        echo "    Remove:  curl -sSL https://get.velocitypulse.io/agent.sh | sudo bash -s -- --uninstall"
    fi
    echo ""
}

run_uninstall() {
    echo ""
    echo -e "${YELLOW}[1/2] Stopping and removing service...${NC}"
    stop_and_remove_service
    echo -e "${GREEN}  Service removed${NC}"

    echo ""
    echo -e "${YELLOW}[2/2] Removing installation directory...${NC}"
    remove_install_dir
    echo -e "${GREEN}  Directory removed${NC}"

    print_uninstall_summary
}

cleanup_temp() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
    if [ -n "$ENV_BACKUP_PATH" ] && [ -f "$ENV_BACKUP_PATH" ]; then
        rm -f "$ENV_BACKUP_PATH"
    fi
}

main() {
    parse_args "$@"
    detect_os
    print_banner
    require_root

    if has_existing_install; then
        EXISTING_INSTALL=true
    fi

    choose_mode
    echo -e "${GREEN}  Selected mode: $MODE${NC}"

    if [ "$MODE" = "uninstall" ]; then
        run_uninstall
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"
    ensure_node
    echo -e "${GREEN}  Node.js $(node --version) OK${NC}"

    prompt_config
    prepare_install_target
    download_release
    install_files
    configure_env_file
    create_service
    cleanup_temp
    print_install_summary
}

main "$@"
