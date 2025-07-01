import ckan.plugins.toolkit as tk
import ckanext.zenodo.logic.schema as schema


@tk.side_effect_free
def zenodo_get_sum(context, data_dict):
    tk.check_access(
        "zenodo_get_sum", context, data_dict)
    data, errors = tk.navl_validate(
        data_dict, schema.zenodo_get_sum(), context)

    if errors:
        raise tk.ValidationError(errors)

    return {
        "left": data["left"],
        "right": data["right"],
        "sum": data["left"] + data["right"]
    }


def get_actions():
    return {
        'zenodo_get_sum': zenodo_get_sum,
    }
