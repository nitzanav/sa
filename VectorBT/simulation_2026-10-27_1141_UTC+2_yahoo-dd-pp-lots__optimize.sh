#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1141_UTC+2_yahoo-dd-pp-lots__optimize.py book --signal-name yahoo-daily --end 2026-10-26
