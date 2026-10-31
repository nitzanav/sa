#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_2101_UTC+2_yahoo-upside-0__optimize.py low --signal-name yahoo-daily --end 2026-10-26
