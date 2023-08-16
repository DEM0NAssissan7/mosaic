uuid="mosaic@mawitime"
files=(
    "drawing.js"
    "enums.js"
    "extension.js"
    "metadata.json"
    "reordering.js"
    "stylesheet.css"
    "tilegroups.js"
    "tiling.js"
    "windowing.js"
)

# Create temporary directory and copy files to it
mkdir -p "$uuid"
for file in ${files[@]}; do
    cp "$file" "$uuid/"
done

# Export directory to zip
zip -r "$uuid.zip" "$uuid"

# Remove temporary directory
rm -r "$uuid"