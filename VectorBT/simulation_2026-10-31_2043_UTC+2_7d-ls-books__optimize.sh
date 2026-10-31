#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-31_2043_UTC+2_7d-ls-books__optimize.py window --end 2026-10-26
