#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-12_0151_UTC+2_two-signal-lots__optimize.py pair --end 2026-10-26
