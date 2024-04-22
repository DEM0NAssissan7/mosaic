#!/bin/bash
uuid="window-mosaic-mode@heikkiket"

# Export directory to zip
(cd extension && zip -r "../$uuid.zip" .)
