#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1552_UTC+2_frozen-grace-stops__optimize.py grace --end 2026-10-26
