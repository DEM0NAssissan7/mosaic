#!/bin/bash
uuid="mosaic@mawitime"

# Export directory to zip
(cd extension && zip -r "../$uuid.zip" .)
