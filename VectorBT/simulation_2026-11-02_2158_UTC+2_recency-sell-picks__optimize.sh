#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-02_2158_UTC+2_recency-sell-picks__optimize.py picks --end 2026-10-26
