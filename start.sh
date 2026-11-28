#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Start LabTracer. Needs Python 3.8 or later.
cd "$(dirname "$0")" || exit 1
exec python3 server.py "$@"
