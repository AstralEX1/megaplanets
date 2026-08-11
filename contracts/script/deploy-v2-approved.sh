#!/usr/bin/env bash
set -euo pipefail

printf 'PRIVATE_KEY (hidden): '
read -r -s PRIVATE_KEY
printf '\n'
export PRIVATE_KEY

printf 'BASESCAN_API_KEY (hidden): '
read -r -s BASESCAN_API_KEY
printf '\n'
export BASESCAN_API_KEY

cd "$(dirname "$0")/.."

MEGAPLANETS_SIMULATION=false forge script \
  script/DeployMegaPlanets.s.sol:DeployMegaPlanets \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  -vvvv
