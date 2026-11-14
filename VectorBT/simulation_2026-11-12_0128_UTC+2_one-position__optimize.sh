#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-12_0128_UTC+2_one-position__optimize.py onepos --end 2026-10-26
