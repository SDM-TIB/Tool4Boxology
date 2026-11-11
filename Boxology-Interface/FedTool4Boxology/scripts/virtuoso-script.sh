#!/usr/bin/env bash
cd /data
echo "loading RDF data to Virtuoso...."

virtuosoIP=$1
virtuosoUser=$2
virtuosoPass=$3
virtuosoPort=$4
virtuosoGraph=$5
outputfolder=$6
dumpstrip="ld_dir('$outputfolder', '*.nt', '$virtuosoGraph');"

echo "ld_dir('$outputfolder', '*.nt', '$virtuosoGraph');" >> load_data.sql
echo "rdf_loader_run();" >> load_data.sql
echo "exec('checkpoint');" >> load_data.sql
echo "WAIT_FOR_CHILDREN; " >> load_data.sql
cat load_data.sql
isql-v $virtuosoIP:$virtuosoPort -U $virtuosoUser -P $virtuosoPass < load_data.sql
rm load_data.sql

echo "Done loading!"