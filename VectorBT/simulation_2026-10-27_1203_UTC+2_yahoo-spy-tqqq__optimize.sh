#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1203_UTC+2_yahoo-spy-tqqq__optimize.py park --signal-name yahoo-daily --end 2026-10-26
