#!/bin/bash

# Exit immediately on Ctrl+C
trap 'echo "Script interrupted by user. Exiting..."; exit 130' INT

INPUT_FOLDER="./input/"
OUTPUT_FOLDER="./output/"

# Get current epoch time with milliseconds
EPOCH=$(date +%s%3N)

# Create temporary file to store map names and versions
temp_file=$(mktemp)

# Convert all maps and collect names
for map in $(ls "$INPUT_FOLDER"); do
    echo "Converting $map..."
    
    # Store map name for JSON generation
    echo "$map" >> "$temp_file"
    
    # Lowercase output folder
    map_lower=$(echo "$map" | tr '[:upper:]' '[:lower:]')
    
    # Run conversion
    npx tsx src/sc.ts --input "$INPUT_FOLDER/$map" --output "$OUTPUT_FOLDER/$map_lower" --no-video -v "$EPOCH"
done

# Generate JSON file properly
echo "{" > versions.json
first=true
while read -r map; do
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> versions.json
    fi
    echo -n "  \"$map\": $EPOCH" >> versions.json
done < "$temp_file"
echo "" >> versions.json
echo "}" >> versions.json

# Clean up temporary file
rm -f "$temp_file"

echo "Versions saved to versions.json"