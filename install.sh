uuid="mosaic@mawitime"
./export-zip.sh # Export to zip
gnome-extensions install "$uuid.zip" # Install using gnome-extensions
rm "$uuid.zip"