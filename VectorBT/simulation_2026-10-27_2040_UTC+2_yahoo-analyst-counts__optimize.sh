#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_2040_UTC+2_yahoo-analyst-counts__optimize.py counts --signal-name yahoo-daily --end 2026-10-26
