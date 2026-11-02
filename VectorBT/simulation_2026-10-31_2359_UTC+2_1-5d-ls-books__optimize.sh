#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-31_2359_UTC+2_1-5d-ls-books__optimize.py horizon --end 2026-10-26
