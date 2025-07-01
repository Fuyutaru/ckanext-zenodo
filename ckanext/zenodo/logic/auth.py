import ckan.plugins.toolkit as tk


@tk.auth_allow_anonymous_access
def zenodo_get_sum(context, data_dict):
    return {"success": True}


def get_auth_functions():
    return {
        "zenodo_get_sum": zenodo_get_sum,
    }
