#!/bin/bash
set -e

echo "========================================="
echo "  RAG App — AWS EC2 Deployment Script"
echo "========================================="

# ---- 1. Install Docker (if not present) ----
if ! command -v docker &> /dev/null; then
    echo "[1/5] Installing Docker..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo "  Docker installed. You may need to log out and back in for group changes."
else
    echo "[1/5] Docker already installed."
fi

# ---- 2. Check .env is configured ----
echo "[2/5] Checking backend .env..."
ENV_FILE="./rag-backend/.env"
if grep -q "YOUR_PROJECT_REF\|your-groq-api-key" "$ENV_FILE"; then
    echo ""
    echo "  ERROR: .env still has placeholder values!"
    echo "  Edit $ENV_FILE and fill in:"
    echo "    - DATABASE_URL  (from Supabase Dashboard > Settings > Database)"
    echo "    - GROQ_API_KEY  (from https://console.groq.com)"
    echo "    - HF_API_TOKEN  (optional, from https://huggingface.co/settings/tokens)"
    echo ""
    exit 1
fi
echo "  .env looks configured."

# ---- 3. Build containers ----
echo "[3/5] Building containers..."
docker compose build

# ---- 4. Run database migration ----
echo "[4/5] Running database migration..."
docker compose up -d backend
sleep 5
docker exec rag-backend alembic upgrade head
echo "  Migration complete."

# ---- 5. Start all services ----
echo "[5/5] Starting all services..."
docker compose up -d

echo ""
echo "========================================="
echo "  Deployment complete!"
echo "========================================="
echo ""
echo "  Frontend:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_IP'):3000"
echo "  Backend:   http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_IP'):8000"
echo "  Health:    http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_IP'):8000/health"
echo ""
echo "  Logs:      docker compose logs -f"
echo "  Stop:      docker compose down"
echo ""
