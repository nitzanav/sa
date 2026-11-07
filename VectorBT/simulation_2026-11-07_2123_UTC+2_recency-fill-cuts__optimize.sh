#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-07_2123_UTC+2_recency-fill-cuts__optimize.py cuts --end 2026-10-26
