#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1309_UTC+2_yahoo-64-dls__optimize.py scale --signal-name yahoo-daily --end 2026-10-26
