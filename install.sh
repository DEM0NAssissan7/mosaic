#!/bin/bash
uuid="mosaic@mawitime"
./export-zip.sh # Export to zip
gnome-extensions install --force "$uuid.zip" # Install using gnome-extensions
rm "$uuid.zip"