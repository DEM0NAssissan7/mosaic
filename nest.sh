#!/bin/sh -e

# export G_MESSAGES_DEBUG=all
export MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080

dbus-run-session -- gnome-shell --nested \ --wayland