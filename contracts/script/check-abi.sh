#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
forge inspect MegaPlanets abi --json | diff -u abi/MegaPlanets.json -
