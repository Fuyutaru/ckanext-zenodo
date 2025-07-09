from ckan.common import CKANConfig
import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit

# import ckanext.zenodo.cli as cli
import ckanext.zenodo.helpers as helpers
# import ckanext.zenodo.views as views
# from ckanext.zenodo.logic import (
#     action, auth, validators
# )


class ZenodoPlugin(plugins.SingletonPlugin, toolkit.DefaultDatasetForm):
    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.ITemplateHelpers)
    plugins.implements(plugins.IDatasetForm, inherit=True)

    def update_config(self, config: CKANConfig):
        toolkit.add_template_directory(config, "templates")
        toolkit.add_public_directory(config, "public")
        toolkit.add_resource("assets", "zenodo")


    def get_helpers(self):
        return {
            'get_zenodo_token': helpers.get_zenodo_token,
            'get_ckan_token': helpers.get_ckan_token
        }

    # def is_fallback(self):
    #     """
    #     This plugin is a fallback for the dataset form, so it should be used
    #     when no other dataset form plugin is available.
    #     """
    #     return True

    def setup_template_variables(self, context, data_dict):
        super(ZenodoPlugin, self).setup_template_variables(context, data_dict)
        want_doi = data_dict.get("want_doi")
        # If not present, try to get it from the dataset's extras
        if not want_doi and "id" in data_dict:
            # Fetch the dataset using the id
            pkg = toolkit.get_action("package_show")({}, {"id": data_dict["id"]})
            for extra in pkg.get("extras", []):
                if extra["key"] == "want_doi":
                    want_doi = extra["value"]
                    break
        if not want_doi:
            want_doi = "no"
        toolkit.c.want_doi = want_doi
        helpers.setup_template_variables(context, data_dict)
        return None
