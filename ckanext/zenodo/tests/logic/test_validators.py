"""Tests for validators.py."""

import pytest

import ckan.plugins.toolkit as tk

from ckanext.zenodo.logic import validators


def test_zenodo_reauired_with_valid_value():
    assert validators.zenodo_required("value") == "value"


def test_zenodo_reauired_with_invalid_value():
    with pytest.raises(tk.Invalid):
        validators.zenodo_required(None)
