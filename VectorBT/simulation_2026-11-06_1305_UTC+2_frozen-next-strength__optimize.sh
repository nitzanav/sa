#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1305_UTC+2_frozen-next-strength__optimize.py next --end 2026-10-26
