#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-14_1319_UTC+2_recency-mix-util__optimize.py mix --end 2026-10-26
