#!/bin/sh -e

# export G_MESSAGES_DEBUG=all
export MUTTER_DEBUG_DUMMY_MODE_SPECS=900x600

dbus-run-session -- \
    gnome-shell --nested \
                --wayland