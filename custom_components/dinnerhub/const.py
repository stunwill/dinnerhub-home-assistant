"""Constants for the DinnerHub integration."""

from datetime import timedelta

DOMAIN = "dinnerhub"
DEFAULT_HOST = "http://d312fc48-dinnerhub:8099"
DEFAULT_SCAN_INTERVAL = 60
SCAN_INTERVAL = timedelta(seconds=DEFAULT_SCAN_INTERVAL)
PLATFORMS = ["sensor", "calendar", "button"]
