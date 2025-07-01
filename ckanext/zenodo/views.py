from flask import Blueprint


zenodo = Blueprint(
    "zenodo", __name__)


def page():
    return "Hello, zenodo!"


zenodo.add_url_rule(
    "/zenodo/page", view_func=page)


def get_blueprints():
    return [zenodo]
