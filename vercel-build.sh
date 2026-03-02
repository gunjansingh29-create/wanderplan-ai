#!/bin/sh

# Install system dependencies for asyncpg and other Python packages
apt-get update
apt-get install -y build-essential python3-dev libpq-dev

# Upgrade pip, setuptools, and wheel
pip install --upgrade pip setuptools wheel

# Install Python dependencies
pip install -r requirements.txt
