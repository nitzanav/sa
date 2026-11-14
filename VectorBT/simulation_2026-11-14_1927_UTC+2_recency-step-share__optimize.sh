#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-14_1927_UTC+2_recency-step-share__optimize.py share --end 2026-10-26
