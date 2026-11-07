#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-07_2300_UTC+2_recency-union-pp__optimize.py union --end 2026-10-26
