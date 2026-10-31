#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1552_UTC+2_yahoo-split-lots__optimize.py fixed --signal-name yahoo-daily --end 2026-10-26
