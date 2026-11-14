#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-12_1025_UTC+2_half-lots__optimize.py half --end 2026-10-26
