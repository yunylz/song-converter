#!/bin/bash

INPUT_FOLDER="./input/"
OUTPUT_FOLDER="./output/"

# Convert all maps
for map in $(ls "$INPUT_FOLDER"); do
    echo "Converting $map..."
    
    # Lowercase output folder
    map_lower=$(echo "$map" | tr '[:upper:]' '[:lower:]')
    
    npx tsx src/sc.ts --input "$INPUT_FOLDER/$map" --output "$OUTPUT_FOLDER/$map_lower" -v
done
