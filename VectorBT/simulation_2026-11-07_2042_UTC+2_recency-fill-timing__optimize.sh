#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-07_2042_UTC+2_recency-fill-timing__optimize.py fills --end 2026-10-26
