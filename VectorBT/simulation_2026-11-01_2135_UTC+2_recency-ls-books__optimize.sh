#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-01_2135_UTC+2_recency-ls-books__optimize.py recency --end 2026-10-26
