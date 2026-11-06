#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1324_UTC+2_frozen-7.5pp__optimize.py pp75 --end 2026-10-26
