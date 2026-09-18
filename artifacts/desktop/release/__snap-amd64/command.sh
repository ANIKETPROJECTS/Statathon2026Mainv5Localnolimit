#!/bin/bash -e
exec "$SNAP/desktop-init.sh" "$SNAP/desktop-common.sh" "$SNAP/desktop-gnome-specific.sh" "$SNAP/airavata-dea-csv-profiler" '--no-sandbox' "$@"