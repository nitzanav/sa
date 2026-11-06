#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1333_UTC+2_frozen-2.5dd-nb__optimize.py nb25 --end 2026-10-26
