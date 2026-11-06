#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-02_2217_UTC+2_recency-date-ranges__optimize.py ranges --end 2026-10-26
