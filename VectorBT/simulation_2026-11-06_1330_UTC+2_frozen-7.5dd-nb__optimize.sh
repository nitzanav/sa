#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1330_UTC+2_frozen-7.5dd-nb__optimize.py nb75 --end 2026-10-26
