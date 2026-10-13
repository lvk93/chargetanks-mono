"""Ersatz fuer das Paket ``supabase`` beim lokalen Betrieb der Legacy-Suite.

Liegt per PYTHONPATH vor site-packages, damit ``frontend/event_tracker.py`` unveraendert
laeuft, ohne Events in die Produktions-Tabelle ``event_logs`` zu schreiben. Jede Zeile,
die das Original einfuegen wuerde, wird stattdessen an die Datei aus der Umgebungsvariable
``STUB_TRACKING_LOG`` angehaengt (JSON Lines), falls gesetzt. So bleibt das Tracking-Verhalten
des Originals dokumentierbar.
"""

import json
import os

__all__ = ["create_client"]


class _Insert:
    def __init__(self, table, row):
        self._table = table
        self._row = row

    def execute(self):
        path = os.environ.get("STUB_TRACKING_LOG")
        if path:
            with open(path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"table": self._table, "row": self._row}, default=str) + "\n")
        return None


class _Table:
    def __init__(self, name):
        self._name = name

    def insert(self, row, *args, **kwargs):
        return _Insert(self._name, row)


class _Client:
    def table(self, name):
        return _Table(name)


def create_client(url, key, *args, **kwargs):
    return _Client()
