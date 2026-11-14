#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-12_0108_UTC+2_strength-divisors-40__optimize.py atdiv --end 2026-10-26
