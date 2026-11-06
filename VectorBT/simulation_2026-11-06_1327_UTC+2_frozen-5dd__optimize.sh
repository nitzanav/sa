#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1327_UTC+2_frozen-5dd__optimize.py dd5 --end 2026-10-26
