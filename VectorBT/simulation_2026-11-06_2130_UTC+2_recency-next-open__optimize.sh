#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_2130_UTC+2_recency-next-open__optimize.py nextopen --end 2026-10-26
