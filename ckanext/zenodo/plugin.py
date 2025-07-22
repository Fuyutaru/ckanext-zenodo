from ckan.common import CKANConfig
import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit
import json
import os

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
            'get_ckan_token': helpers.get_ckan_token,
            'get_resource_types': self.get_resource_types,
            'get_contributor_roles': self.get_contributor_roles,
        }

    def get_resource_types(self):
        resource_types_path = os.path.join(os.path.dirname(__file__), 'config', 'resource_types.json')
        with open(resource_types_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_contributor_roles(self):
        contributor_roles_path = os.path.join(os.path.dirname(__file__), 'config', 'contributor_roles.json')
        with open(contributor_roles_path, 'r', encoding='utf-8') as f:
            return json.load(f)





