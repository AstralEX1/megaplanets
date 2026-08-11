#!/usr/bin/env bash
set -euo pipefail

printf 'PRIVATE_KEY (hidden): '
read -r -s PRIVATE_KEY
printf '\n'
export PRIVATE_KEY

cd "$(dirname "$0")/.."

# BaseScan verification is a separate step. After the approved broadcast, keep
# the deployment evidence and run script/verify-v2-basescan.sh only when the
# current session already provides BASESCAN_API_KEY.
MEGAPLANETS_SIMULATION=false forge script \
  script/DeployMegaPlanets.s.sol:DeployMegaPlanets \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  -vvvv
