#!/usr/bin/env bash
config_dir=/data/configs/
cd /data/configs
for entry in "$config_dir"/*
do
  python3 -m rdfizer -c $entry
done
