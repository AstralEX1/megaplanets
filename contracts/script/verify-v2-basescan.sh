#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASESCAN_API_KEY:-}" ]]; then
  echo 'Set BASESCAN_API_KEY in the session environment before running this script.' >&2
  exit 1
fi

cd "$(dirname "$0")/.."
ARGS=$(cast abi-encode \
  'constructor(address,address,address)' \
  0xCfc1044C749fD40E07FE33938414Fa573993F857 \
  0xCfc1044C749fD40E07FE33938414Fa573993F857 \
  0x45084829ac63f9dC6a3D4981A46FA896f9180ECd)

forge verify-contract \
  0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2 \
  src/MegaPlanets.sol:MegaPlanets \
  --chain-id 84532 \
  --verifier etherscan \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --constructor-args "$ARGS" \
  --watch
