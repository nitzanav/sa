#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1536_UTC+2_yahoo-cash-strength__optimize.py cash --signal-name yahoo-daily --end 2026-10-26
