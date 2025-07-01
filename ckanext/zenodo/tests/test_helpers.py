"""Tests for helpers.py."""

import ckanext.zenodo.helpers as helpers


def test_zenodo_hello():
    assert helpers.zenodo_hello() == "Hello, zenodo!"
