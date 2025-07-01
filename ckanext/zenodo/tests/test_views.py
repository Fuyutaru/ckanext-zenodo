"""Tests for views.py."""

import pytest

import ckanext.zenodo.validators as validators


import ckan.plugins.toolkit as tk


@pytest.mark.ckan_config("ckan.plugins", "zenodo")
@pytest.mark.usefixtures("with_plugins")
def test_zenodo_blueprint(app, reset_db):
    resp = app.get(tk.h.url_for("zenodo.page"))
    assert resp.status_code == 200
    assert resp.body == "Hello, zenodo!"
