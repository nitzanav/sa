#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-13_1457_UTC+2_half-dd__optimize.py half --end 2026-10-26
