#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-02_2255_UTC+2_formula-confirm__optimize.py confirm --end 2026-10-26
