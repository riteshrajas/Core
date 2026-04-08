#!/usr/bin/env bash
set -e

if [ -d "\.venv" ]; then
    echo "Virtual environment already exists. Activating..."
else
    echo "Creating virtual environment..."
    python -m venv ".venv"
fi

source ".venv/bin/activate"
echo "Virtual environment activated."
